namespace Api.Models;

public class Tenant
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;

    public string Status { get; set; } = TenantStatuses.Active;

    public string SubscriptionTier { get; set; } = SubscriptionTiers.Starter;

    public string SubscriptionStatus { get; set; } = BillingSubscriptionStatuses.Active;

    /// <summary>
    /// When SubscriptionStatus last changed (used for PastDue grace enforcement).
    /// </summary>
    public DateTime? SubscriptionStatusChangedAt { get; set; }

    public string? StripeCustomerId { get; set; }

    public string? StripeSubscriptionId { get; set; }

    public DateTime? CurrentPeriodEnd { get; set; }

    public string? PrimaryColor { get; set; }

    public string? LogoUrl { get; set; }

    public bool IsDeleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Customer> Customers { get; set; } = new List<Customer>();

    public ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();

    public ICollection<User> Users { get; set; } = new List<User>();
}
