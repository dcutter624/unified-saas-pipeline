using System.Globalization;
using System.Text;
using Api.Data;
using Api.Dtos;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class BillingService(
    AppDbContext db,
    ITenantService tenantService,
    IConfiguration configuration,
    IAuditLogger auditLogger)
{
    public async Task<BillingSubscriptionResponse?> GetSubscriptionAsync(
        CancellationToken cancellationToken = default)
    {
        var tenantId = tenantService.GetRequiredTenantId();
        var tenant = await db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);

        return tenant is null ? null : ToResponse(tenant);
    }

    public async Task<(CheckoutSessionResponse? Session, string? Error)> CreateCheckoutSessionAsync(
        CreateCheckoutSessionRequest request,
        CancellationToken cancellationToken = default)
    {
        var tenantId = tenantService.GetRequiredTenantId();
        var tier = SubscriptionTiers.Normalize(request.Tier);

        if (!SubscriptionTiers.Allowed.Contains(tier))
        {
            return (null, $"Tier must be one of: {string.Join(", ", SubscriptionTiers.Allowed)}.");
        }

        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return (null, "Tenant not found.");
        }

        tenant.StripeCustomerId ??= $"cus_mock_{tenant.Id:N}"[..24];
        await db.SaveChangesAsync(cancellationToken);

        var sessionId = $"cs_mock_{Guid.NewGuid():N}";
        var frontendBase = ResolveFrontendBase(request.SuccessUrl);
        var checkoutUrl =
            $"{frontendBase}/billing?checkout=mock&session_id={Uri.EscapeDataString(sessionId)}"
            + $"&tier={Uri.EscapeDataString(tier)}"
            + $"&customer={Uri.EscapeDataString(tenant.StripeCustomerId)}";

        return (new CheckoutSessionResponse(
            sessionId,
            checkoutUrl,
            tier,
            "mock",
            "Mock Stripe Checkout session created. Complete it from Billing or POST /api/billing/webhook."), null);
    }

    public async Task<(BillingSubscriptionResponse? Subscription, string? Error)> HandleWebhookAsync(
        StripeWebhookRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Type))
        {
            return (null, "Webhook type is required.");
        }

        var payload = request.Data?.Object;
        if (payload is null)
        {
            return (null, "Webhook data.object is required.");
        }

        var tenant = await ResolveTenantAsync(payload, cancellationToken);
        if (tenant is null)
        {
            return (null, "Unable to resolve tenant from webhook payload.");
        }

        var eventType = request.Type.Trim().ToLowerInvariant();
        var previousStatus = tenant.SubscriptionStatus;
        switch (eventType)
        {
            case "invoice.payment_succeeded":
            case "customer.subscription.updated":
            case "checkout.session.completed":
            {
                var tier = SubscriptionTiers.Normalize(
                    GetMetadata(payload, "tier") ?? tenant.SubscriptionTier);
                tenant.SubscriptionTier = tier;
                tenant.SubscriptionStatus = BillingSubscriptionStatuses.Active;
                tenant.StripeCustomerId = payload.Customer ?? tenant.StripeCustomerId;
                tenant.StripeSubscriptionId = payload.Subscription
                    ?? payload.Id
                    ?? tenant.StripeSubscriptionId
                    ?? $"sub_mock_{Guid.NewGuid():N}"[..24];
                tenant.CurrentPeriodEnd = payload.CurrentPeriodEnd is long unix
                    ? DateTimeOffset.FromUnixTimeSeconds(unix).UtcDateTime
                    : DateTime.UtcNow.AddMonths(1);
                break;
            }
            case "invoice.payment_failed":
                tenant.SubscriptionStatus = BillingSubscriptionStatuses.PastDue;
                break;
            case "customer.subscription.deleted":
                tenant.SubscriptionStatus = BillingSubscriptionStatuses.Canceled;
                tenant.SubscriptionTier = SubscriptionTiers.Starter;
                tenant.StripeSubscriptionId = null;
                tenant.CurrentPeriodEnd = DateTime.UtcNow;
                break;
            default:
                return (null, $"Unsupported webhook type '{request.Type}'.");
        }

        if (!string.Equals(previousStatus, tenant.SubscriptionStatus, StringComparison.OrdinalIgnoreCase))
        {
            tenant.SubscriptionStatusChangedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);

        await auditLogger.LogAsync(
            AuditActions.BillingWebhook,
            nameof(Tenant),
            tenant.Id,
            tenant.Id,
            username: "stripe-webhook",
            cancellationToken: cancellationToken);

        return (ToResponse(tenant), null);
    }

    public async Task<IResult?> EnsureFeatureAsync(
        string feature,
        CancellationToken cancellationToken = default)
    {
        var tenantId = tenantService.GetRequiredTenantId();
        var tenant = await db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);

        if (tenant is null)
        {
            return Results.NotFound(new { message = "Tenant not found." });
        }

        if (TenantFeatures.Allows(tenant.SubscriptionTier, feature))
        {
            return null;
        }

        return Results.Json(
            new
            {
                message = $"Feature '{feature}' requires a higher subscription tier.",
                requiredFeature = feature,
                currentTier = tenant.SubscriptionTier,
                upgradePath = "/billing"
            },
            statusCode: StatusCodes.Status403Forbidden);
    }

    public async Task<string?> ExportAuditCsvAsync(CancellationToken cancellationToken = default)
    {
        tenantService.GetRequiredTenantId();

        var logs = await db.AuditLogs
            .AsNoTracking()
            .OrderByDescending(a => a.Timestamp)
            .Take(5000)
            .ToListAsync(cancellationToken);

        var sb = new StringBuilder();
        sb.AppendLine("Id,Timestamp,Username,Action,EntityName,EntityId,IpAddress");
        foreach (var log in logs)
        {
            sb.Append(Escape(log.Id.ToString())).Append(',')
                .Append(Escape(log.Timestamp.ToString("O", CultureInfo.InvariantCulture))).Append(',')
                .Append(Escape(log.Username)).Append(',')
                .Append(Escape(log.Action)).Append(',')
                .Append(Escape(log.EntityName)).Append(',')
                .Append(Escape(log.EntityId?.ToString() ?? string.Empty)).Append(',')
                .Append(Escape(log.IpAddress ?? string.Empty))
                .AppendLine();
        }

        return sb.ToString();
    }

    private async Task<Tenant?> ResolveTenantAsync(
        StripeWebhookObject payload,
        CancellationToken cancellationToken)
    {
        if (Guid.TryParse(GetMetadata(payload, "tenant_id"), out var tenantId))
        {
            return await db.Tenants.IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == tenantId && !t.IsDeleted, cancellationToken);
        }

        if (!string.IsNullOrWhiteSpace(payload.Customer))
        {
            return await db.Tenants.IgnoreQueryFilters()
                .FirstOrDefaultAsync(
                    t => t.StripeCustomerId == payload.Customer && !t.IsDeleted,
                    cancellationToken);
        }

        if (!string.IsNullOrWhiteSpace(payload.Subscription))
        {
            return await db.Tenants.IgnoreQueryFilters()
                .FirstOrDefaultAsync(
                    t => t.StripeSubscriptionId == payload.Subscription && !t.IsDeleted,
                    cancellationToken);
        }

        // Authenticated admin simulating webhook for own tenant.
        if (tenantService.IsResolved)
        {
            return await db.Tenants.FirstOrDefaultAsync(
                t => t.Id == tenantService.TenantId,
                cancellationToken);
        }

        return null;
    }

    private string ResolveFrontendBase(string? successUrl)
    {
        if (!string.IsNullOrWhiteSpace(successUrl)
            && Uri.TryCreate(successUrl, UriKind.Absolute, out var successUri))
        {
            return $"{successUri.Scheme}://{successUri.Authority}";
        }

        var configured = configuration["Billing:FrontendBaseUrl"]
            ?? Environment.GetEnvironmentVariable("FRONTEND_BASE_URL")
            ?? "http://localhost:5173";

        return configured.TrimEnd('/');
    }

    private static string? GetMetadata(StripeWebhookObject payload, string key)
    {
        if (payload.Metadata is null)
        {
            return null;
        }

        return payload.Metadata.TryGetValue(key, out var value) ? value : null;
    }

    private static BillingSubscriptionResponse ToResponse(Tenant tenant)
    {
        var tier = SubscriptionTiers.Normalize(tenant.SubscriptionTier);
        var plans = new List<PlanCatalogItem>
        {
            new(
                SubscriptionTiers.Starter,
                TierPricing.GetMonthlyPrice(SubscriptionTiers.Starter),
                "Core dashboard and basic analytics",
                ["Overview dashboard", "Basic analytics (30d / 6m)", "Tenant branding"],
                tier == SubscriptionTiers.Starter),
            new(
                SubscriptionTiers.Pro,
                TierPricing.GetMonthlyPrice(SubscriptionTiers.Pro),
                "Growth suite with advanced insights",
                ["Everything in Starter", "Advanced analytics (12m)", "Audit CSV export", "Unlimited users"],
                tier == SubscriptionTiers.Pro),
            new(
                SubscriptionTiers.Enterprise,
                TierPricing.GetMonthlyPrice(SubscriptionTiers.Enterprise),
                "Full platform with priority support",
                ["Everything in Pro", "Priority support", "Custom onboarding"],
                tier == SubscriptionTiers.Enterprise)
        };

        return new BillingSubscriptionResponse(
            tenant.Id,
            tenant.Name,
            tier,
            BillingSubscriptionStatuses.Normalize(tenant.SubscriptionStatus),
            TierPricing.GetMonthlyPrice(tier),
            tenant.CurrentPeriodEnd,
            tenant.StripeCustomerId,
            tenant.StripeSubscriptionId,
            TenantFeatures.BuildFlags(tier),
            plans);
    }

    private static string Escape(string value)
    {
        if (value.Contains('"') || value.Contains(',') || value.Contains('\n'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }
}
