namespace Api.Models;

/// <summary>
/// Daily MRR point-in-time capture per tenant for historical analytics.
/// </summary>
public class MrrSnapshot
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public DateOnly SnapshotDate { get; set; }

    public decimal Mrr { get; set; }

    public int ActiveSubscriptionCount { get; set; }

    public int ActiveCustomerCount { get; set; }

    public string SubscriptionTier { get; set; } = SubscriptionTiers.Starter;

    public string BillingStatus { get; set; } = BillingSubscriptionStatuses.Active;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Tenant? Tenant { get; set; }
}
