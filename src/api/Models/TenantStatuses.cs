namespace Api.Models;

public static class TenantStatuses
{
    public const string Active = "Active";
    public const string Inactive = "Inactive";
    public const string Suspended = "Suspended";

    public static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        Active,
        Inactive,
        Suspended
    };

    public static bool IsDisabled(string? status) =>
        status is not null
        && (status.Equals(Inactive, StringComparison.OrdinalIgnoreCase)
            || status.Equals(Suspended, StringComparison.OrdinalIgnoreCase));
}
