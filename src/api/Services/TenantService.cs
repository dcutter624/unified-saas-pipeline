using System.Security.Claims;

namespace Api.Services;

public class TenantService(IHttpContextAccessor httpContextAccessor) : ITenantService
{
    public const string TenantIdClaimType = "tenant_id";

    public Guid? TenantId
    {
        get
        {
            var user = httpContextAccessor.HttpContext?.User;
            if (user?.Identity?.IsAuthenticated != true)
            {
                return null;
            }

            var raw = user.FindFirstValue(TenantIdClaimType);
            return Guid.TryParse(raw, out var tenantId) ? tenantId : null;
        }
    }

    public bool IsResolved => TenantId.HasValue;

    public Guid GetRequiredTenantId()
    {
        var tenantId = TenantId;
        if (!tenantId.HasValue)
        {
            throw new UnauthorizedAccessException("A valid tenant_id claim is required.");
        }

        return tenantId.Value;
    }
}
