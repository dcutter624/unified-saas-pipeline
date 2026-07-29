using Api.Data;
using Api.Dtos;
using Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Api.Services;

public class MaintenanceOptions
{
    public const string SectionName = "Maintenance";

    /// <summary>How often the hosted service runs (hours).</summary>
    public double IntervalHours { get; set; } = 24;

    /// <summary>Soft-deleted tenants/users older than this are hard-purged.</summary>
    public int SoftDeleteRetentionDays { get; set; } = 30;

    /// <summary>PastDue billing beyond this grace window suspends the tenant.</summary>
    public int PastDueGraceDays { get; set; } = 7;

    /// <summary>Optional delay before the first background tick.</summary>
    public double StartupDelayMinutes { get; set; } = 1;

    public string? SystemApiKey { get; set; }
}

public class TenantMaintenanceService(
    AppDbContext db,
    IOptions<MaintenanceOptions> options,
    ILogger<TenantMaintenanceService> logger)
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public async Task<MaintenanceRunResult> RunAsync(
        string trigger,
        CancellationToken cancellationToken = default)
    {
        if (!await Gate.WaitAsync(0, cancellationToken))
        {
            throw new InvalidOperationException("A maintenance run is already in progress.");
        }

        var started = DateTime.UtcNow;
        try
        {
            var snapshots = await RecordMrrSnapshotsAsync(cancellationToken);
            var purged = await PurgeExpiredSoftDeletesAsync(cancellationToken);
            var suspended = await SuspendPastDueTenantsAsync(cancellationToken);

            var result = new MaintenanceRunResult(
                snapshots,
                purged,
                suspended,
                started,
                DateTime.UtcNow,
                trigger);

            logger.LogInformation(
                "Maintenance complete ({Trigger}): snapshots={Snapshots}, purged={Purged}, suspended={Suspended}",
                trigger,
                snapshots,
                purged,
                suspended);

            return result;
        }
        finally
        {
            Gate.Release();
        }
    }

    private async Task<int> RecordMrrSnapshotsAsync(CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var tenants = await db.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(t => !t.IsDeleted && t.Status == TenantStatuses.Active)
            .Select(t => new { t.Id, t.SubscriptionTier, t.SubscriptionStatus })
            .ToListAsync(cancellationToken);

        if (tenants.Count == 0)
        {
            return 0;
        }

        var tenantIds = tenants.Select(t => t.Id).ToList();

        var activeSubscriptions = await db.Subscriptions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(s =>
                tenantIds.Contains(s.TenantId)
                && s.Status.ToLower() == "active"
                && (s.EndDate == null || s.EndDate > DateTime.UtcNow))
            .Select(s => new { s.TenantId, s.Tier, s.CustomerId })
            .ToListAsync(cancellationToken);

        var existing = await db.MrrSnapshots
            .AsNoTracking()
            .Where(s => s.SnapshotDate == today && tenantIds.Contains(s.TenantId))
            .Select(s => s.TenantId)
            .ToListAsync(cancellationToken);

        var existingSet = existing.ToHashSet();
        var recorded = 0;

        foreach (var tenant in tenants)
        {
            if (existingSet.Contains(tenant.Id))
            {
                continue;
            }

            var subs = activeSubscriptions.Where(s => s.TenantId == tenant.Id).ToList();
            var mrr = subs.Sum(s => TierPricing.GetMonthlyPrice(s.Tier));
            var activeCustomers = subs.Select(s => s.CustomerId).Distinct().Count();

            db.MrrSnapshots.Add(new MrrSnapshot
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                SnapshotDate = today,
                Mrr = decimal.Round(mrr, 2),
                ActiveSubscriptionCount = subs.Count,
                ActiveCustomerCount = activeCustomers,
                SubscriptionTier = SubscriptionTiers.Normalize(tenant.SubscriptionTier),
                BillingStatus = BillingSubscriptionStatuses.Normalize(tenant.SubscriptionStatus),
                CreatedAt = DateTime.UtcNow
            });
            recorded++;
        }

        if (recorded > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
        }

        return recorded;
    }

    private async Task<int> PurgeExpiredSoftDeletesAsync(CancellationToken cancellationToken)
    {
        var retentionDays = Math.Max(1, options.Value.SoftDeleteRetentionDays);
        var cutoff = DateTime.UtcNow.AddDays(-retentionDays);
        var purged = 0;

        // Users first (tenant FK), then tenants and dependents.
        var expiredUsers = await db.Users
            .IgnoreQueryFilters()
            .Where(u => u.IsDeleted && u.DeletedAt != null && u.DeletedAt < cutoff)
            .Select(u => u.Id)
            .ToListAsync(cancellationToken);

        if (expiredUsers.Count > 0)
        {
            purged += await db.Users
                .IgnoreQueryFilters()
                .Where(u => expiredUsers.Contains(u.Id))
                .ExecuteDeleteAsync(cancellationToken);
        }

        var expiredTenants = await db.Tenants
            .IgnoreQueryFilters()
            .Where(t => t.IsDeleted && t.DeletedAt != null && t.DeletedAt < cutoff)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        foreach (var tenantId in expiredTenants)
        {
            purged += await db.Subscriptions
                .IgnoreQueryFilters()
                .Where(s => s.TenantId == tenantId)
                .ExecuteDeleteAsync(cancellationToken);

            purged += await db.Customers
                .IgnoreQueryFilters()
                .Where(c => c.TenantId == tenantId)
                .ExecuteDeleteAsync(cancellationToken);

            purged += await db.Users
                .IgnoreQueryFilters()
                .Where(u => u.TenantId == tenantId)
                .ExecuteDeleteAsync(cancellationToken);

            purged += await db.AuditLogs
                .IgnoreQueryFilters()
                .Where(a => a.TenantId == tenantId)
                .ExecuteDeleteAsync(cancellationToken);

            purged += await db.MrrSnapshots
                .Where(s => s.TenantId == tenantId)
                .ExecuteDeleteAsync(cancellationToken);

            purged += await db.Tenants
                .IgnoreQueryFilters()
                .Where(t => t.Id == tenantId)
                .ExecuteDeleteAsync(cancellationToken);
        }

        return purged;
    }

    private async Task<int> SuspendPastDueTenantsAsync(CancellationToken cancellationToken)
    {
        var graceDays = Math.Max(1, options.Value.PastDueGraceDays);
        var cutoff = DateTime.UtcNow.AddDays(-graceDays);

        var pastDue = await db.Tenants
            .IgnoreQueryFilters()
            .Where(t =>
                !t.IsDeleted
                && t.SubscriptionStatus == BillingSubscriptionStatuses.PastDue
                && t.Status != TenantStatuses.Suspended
                && t.SubscriptionStatusChangedAt != null
                && t.SubscriptionStatusChangedAt < cutoff)
            .ToListAsync(cancellationToken);

        if (pastDue.Count == 0)
        {
            return 0;
        }

        foreach (var tenant in pastDue)
        {
            tenant.Status = TenantStatuses.Suspended;
        }

        await db.SaveChangesAsync(cancellationToken);
        return pastDue.Count;
    }
}
