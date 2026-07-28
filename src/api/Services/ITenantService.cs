namespace Api.Services;

public interface ITenantService
{
    Guid? TenantId { get; }

    bool IsResolved { get; }

    Guid GetRequiredTenantId();
}
