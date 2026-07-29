namespace Api.Models;

public static class SubscriptionTiers
{
    public const string Starter = "Starter";
    public const string Pro = "Pro";
    public const string Enterprise = "Enterprise";

    public static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        Starter,
        Pro,
        Enterprise
    };

    public static string Normalize(string? tier)
    {
        if (string.IsNullOrWhiteSpace(tier))
        {
            return Starter;
        }

        foreach (var allowed in Allowed)
        {
            if (allowed.Equals(tier.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return allowed;
            }
        }

        return Starter;
    }

    public static int Rank(string? tier) => Normalize(tier) switch
    {
        Enterprise => 3,
        Pro => 2,
        _ => 1
    };

    public static bool IsAtLeast(string? currentTier, string requiredTier) =>
        Rank(currentTier) >= Rank(requiredTier);
}

public static class BillingSubscriptionStatuses
{
    public const string Active = "Active";
    public const string PastDue = "PastDue";
    public const string Canceled = "Canceled";

    public static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        Active,
        PastDue,
        Canceled
    };

    public static string Normalize(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return Active;
        }

        foreach (var allowed in Allowed)
        {
            if (allowed.Equals(status.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return allowed;
            }
        }

        return Active;
    }
}

public static class TenantFeatures
{
    public const string AdvancedAnalytics = "advanced_analytics";
    public const string AuditCsvExport = "audit_csv_export";
    public const string PrioritySupport = "priority_support";

    public static bool Allows(string? tier, string feature) =>
        feature switch
        {
            AdvancedAnalytics => SubscriptionTiers.IsAtLeast(tier, SubscriptionTiers.Pro),
            AuditCsvExport => SubscriptionTiers.IsAtLeast(tier, SubscriptionTiers.Pro),
            PrioritySupport => SubscriptionTiers.IsAtLeast(tier, SubscriptionTiers.Enterprise),
            _ => true
        };

    public static IReadOnlyDictionary<string, bool> BuildFlags(string? tier) =>
        new Dictionary<string, bool>
        {
            ["dashboard"] = true,
            ["basicAnalytics"] = true,
            [AdvancedAnalytics] = Allows(tier, AdvancedAnalytics),
            [AuditCsvExport] = Allows(tier, AuditCsvExport),
            [PrioritySupport] = Allows(tier, PrioritySupport),
            ["unlimitedUsers"] = SubscriptionTiers.IsAtLeast(tier, SubscriptionTiers.Pro),
            ["customBranding"] = true
        };
}
