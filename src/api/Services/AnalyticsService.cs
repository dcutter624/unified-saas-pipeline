using Api.Data;
using Api.Dtos;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class AnalyticsService(AppDbContext db, ITenantService tenantService)
{
    private static readonly string[] CanonicalStatuses =
    [
        "Active",
        "Pending",
        "Cancelled",
        "Paused",
        "Inactive"
    ];

    public async Task<AnalyticsSummaryResponse> GetSummaryAsync(
        string? period,
        CancellationToken cancellationToken = default)
    {
        tenantService.GetRequiredTenantId();

        var normalizedPeriod = NormalizePeriod(period);
        var rangeEnd = DateTime.UtcNow;
        var (rangeStart, bucketKind) = ResolveRange(normalizedPeriod, rangeEnd);

        var customers = await db.Customers
            .AsNoTracking()
            .Select(c => new CustomerSnapshot(c.Id, c.CreatedAt))
            .ToListAsync(cancellationToken);

        var subscriptions = await db.Subscriptions
            .AsNoTracking()
            .Select(s => new SubscriptionSnapshot(
                s.Id,
                s.Status,
                s.Tier,
                s.StartDate,
                s.EndDate,
                s.CustomerId))
            .ToListAsync(cancellationToken);

        var activeSubs = subscriptions.Where(s => IsActiveStatus(s.Status)).ToList();
        var totalMrr = activeSubs.Sum(s => TierPricing.GetMonthlyPrice(s.Tier));
        var activeCustomers = activeSubs.Select(s => s.CustomerId).Distinct().Count();
        var arpu = activeCustomers == 0 ? 0m : decimal.Round(totalMrr / activeCustomers, 2);

        var inactiveCount = subscriptions.Count(s => IsInactiveLike(s.Status));
        var inactivePercentage = subscriptions.Count == 0
            ? 0m
            : decimal.Round(inactiveCount * 100m / subscriptions.Count, 2);

        var series = bucketKind == BucketKind.Day
            ? BuildDailySeries(rangeStart, rangeEnd, customers, subscriptions)
            : BuildMonthlySeries(rangeStart, rangeEnd, customers, subscriptions);

        var (mrrTrend, customerTrend) = ComputeTrends(series);

        return new AnalyticsSummaryResponse(
            normalizedPeriod,
            DateTime.UtcNow,
            rangeStart,
            rangeEnd,
            new AnalyticsKpis(
                decimal.Round(totalMrr, 2),
                arpu,
                inactivePercentage,
                inactivePercentage,
                activeCustomers,
                customers.Count,
                activeSubs.Count,
                subscriptions.Count,
                mrrTrend,
                customerTrend),
            BuildStatusDistribution(subscriptions.Select(s => s.Status)),
            series);
    }

    private static string NormalizePeriod(string? period) =>
        (period ?? "6m").Trim().ToLowerInvariant() switch
        {
            "30d" or "30" or "1m" => "30d",
            "12m" or "1y" or "year" => "12m",
            _ => "6m"
        };

    private static (DateTime RangeStart, BucketKind Kind) ResolveRange(string period, DateTime rangeEnd) =>
        period switch
        {
            "30d" => (rangeEnd.Date.AddDays(-29), BucketKind.Day),
            "12m" => (StartOfMonth(rangeEnd).AddMonths(-11), BucketKind.Month),
            _ => (StartOfMonth(rangeEnd).AddMonths(-5), BucketKind.Month)
        };

    private static List<StatusDistributionItem> BuildStatusDistribution(IEnumerable<string> statuses)
    {
        var counts = statuses
            .Select(NormalizeStatus)
            .GroupBy(s => s)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);

        if (counts.Count == 0)
        {
            return CanonicalStatuses
                .Where(s => s is not "Inactive")
                .Select(s => new StatusDistributionItem(s, 0))
                .ToList();
        }

        var items = new List<StatusDistributionItem>();
        foreach (var status in CanonicalStatuses)
        {
            counts.TryGetValue(status, out var count);
            if (status == "Inactive" && count == 0)
            {
                continue;
            }

            if (count > 0 || status is "Active" or "Pending" or "Cancelled" or "Paused")
            {
                items.Add(new StatusDistributionItem(status, count));
            }
        }

        foreach (var orphan in counts.Keys.Except(CanonicalStatuses, StringComparer.OrdinalIgnoreCase))
        {
            items.Add(new StatusDistributionItem(orphan, counts[orphan]));
        }

        return items;
    }

    private static List<AnalyticsSeriesPoint> BuildMonthlySeries(
        DateTime rangeStart,
        DateTime rangeEnd,
        IReadOnlyList<CustomerSnapshot> customers,
        IReadOnlyList<SubscriptionSnapshot> subscriptions)
    {
        var points = new List<AnalyticsSeriesPoint>();
        var cursor = StartOfMonth(rangeStart);
        var endMonth = StartOfMonth(rangeEnd);

        while (cursor <= endMonth)
        {
            var monthStart = cursor;
            var monthEnd = monthStart.AddMonths(1);
            points.Add(BuildPoint(
                monthStart.ToString("yyyy-MM"),
                monthStart.ToString("MMM yyyy"),
                monthStart,
                monthEnd,
                customers,
                subscriptions));
            cursor = cursor.AddMonths(1);
        }

        return points;
    }

    private static List<AnalyticsSeriesPoint> BuildDailySeries(
        DateTime rangeStart,
        DateTime rangeEnd,
        IReadOnlyList<CustomerSnapshot> customers,
        IReadOnlyList<SubscriptionSnapshot> subscriptions)
    {
        var points = new List<AnalyticsSeriesPoint>();
        var cursor = rangeStart.Date;
        var endDay = rangeEnd.Date;

        while (cursor <= endDay)
        {
            var dayStart = cursor;
            var dayEnd = dayStart.AddDays(1);
            points.Add(BuildPoint(
                dayStart.ToString("yyyy-MM-dd"),
                dayStart.ToString("MMM d"),
                dayStart,
                dayEnd,
                customers,
                subscriptions));
            cursor = cursor.AddDays(1);
        }

        return points;
    }

    private static AnalyticsSeriesPoint BuildPoint(
        string bucket,
        string label,
        DateTime windowStart,
        DateTime windowEnd,
        IReadOnlyList<CustomerSnapshot> customers,
        IReadOnlyList<SubscriptionSnapshot> subscriptions)
    {
        var newCustomers = customers.Count(c => c.CreatedAt >= windowStart && c.CreatedAt < windowEnd);
        var cumulativeCustomers = customers.Count(c => c.CreatedAt < windowEnd);

        var activeInWindow = subscriptions
            .Where(s => s.StartDate < windowEnd && (s.EndDate is null || s.EndDate >= windowStart))
            .ToList();

        var mrr = activeInWindow.Sum(s => TierPricing.GetMonthlyPrice(s.Tier));

        return new AnalyticsSeriesPoint(
            bucket,
            label,
            decimal.Round(mrr, 2),
            newCustomers,
            cumulativeCustomers,
            activeInWindow.Count);
    }

    private static (decimal? MrrTrend, decimal? CustomerTrend) ComputeTrends(
        IReadOnlyList<AnalyticsSeriesPoint> series)
    {
        if (series.Count < 2)
        {
            return (null, null);
        }

        var previous = series[^2];
        var current = series[^1];

        return (
            PercentChange(previous.Mrr, current.Mrr),
            PercentChange(previous.CumulativeCustomers, current.CumulativeCustomers));
    }

    private static decimal? PercentChange(decimal previous, decimal current)
    {
        if (previous == 0)
        {
            return current == 0 ? 0m : 100m;
        }

        return decimal.Round((current - previous) / previous * 100m, 1);
    }

    private static decimal? PercentChange(int previous, int current) =>
        PercentChange((decimal)previous, current);

    private static DateTime StartOfMonth(DateTime value) =>
        new(value.Year, value.Month, 1, 0, 0, 0, DateTimeKind.Utc);

    private static bool IsActiveStatus(string? status) =>
        string.Equals(NormalizeStatus(status), "Active", StringComparison.OrdinalIgnoreCase);

    private static bool IsInactiveLike(string? status)
    {
        var normalized = NormalizeStatus(status);
        return normalized is "Inactive" or "Cancelled" or "Paused";
    }

    private static string NormalizeStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return "Unknown";
        }

        var trimmed = status.Trim();
        foreach (var canonical in CanonicalStatuses)
        {
            if (canonical.Equals(trimmed, StringComparison.OrdinalIgnoreCase))
            {
                return canonical;
            }
        }

        return trimmed;
    }

    private enum BucketKind
    {
        Day,
        Month
    }

    private sealed record CustomerSnapshot(Guid Id, DateTime CreatedAt);

    private sealed record SubscriptionSnapshot(
        Guid Id,
        string Status,
        string Tier,
        DateTime StartDate,
        DateTime? EndDate,
        Guid CustomerId);
}
