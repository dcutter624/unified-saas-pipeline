namespace Api.Models;

/// <summary>
/// Shared tier → MRR mapping used by analytics KPIs (mirrors dashboard estimates).
/// </summary>
public static class TierPricing
{
    public static decimal GetMonthlyPrice(string? tier) =>
        (tier ?? string.Empty).Trim() switch
        {
            "Enterprise" => 299m,
            "Pro" => 99m,
            "Pro Tier" => 99m,
            "Starter" => 29m,
            _ => 49m
        };
}
