using System.Security.Claims;
using Api.Data;
using Api.Models;

namespace Api.Services;

public interface IAuditLogger
{
    Task LogAsync(
        string action,
        string entityName,
        Guid? entityId = null,
        Guid? tenantId = null,
        Guid? userId = null,
        string? username = null,
        CancellationToken cancellationToken = default);
}

public class AuditLogger(
    AppDbContext db,
    IHttpContextAccessor httpContextAccessor,
    ITenantService tenantService) : IAuditLogger
{
    public async Task LogAsync(
        string action,
        string entityName,
        Guid? entityId = null,
        Guid? tenantId = null,
        Guid? userId = null,
        string? username = null,
        CancellationToken cancellationToken = default)
    {
        var httpContext = httpContextAccessor.HttpContext;
        var user = httpContext?.User;

        var resolvedTenantId = tenantId
            ?? tenantService.TenantId
            ?? TryParseGuid(user?.FindFirstValue("tenant_id"));

        if (resolvedTenantId is null || resolvedTenantId == Guid.Empty)
        {
            return;
        }

        var resolvedUserId = userId
            ?? TryParseGuid(user?.FindFirstValue(ClaimTypes.NameIdentifier));

        var resolvedUsername = !string.IsNullOrWhiteSpace(username)
            ? username.Trim()
            : user?.FindFirstValue(ClaimTypes.Name)
              ?? user?.Identity?.Name
              ?? "system";

        var ipAddress = httpContext?.Connection.RemoteIpAddress?.ToString();

        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = resolvedTenantId.Value,
            UserId = resolvedUserId,
            Username = resolvedUsername,
            Action = action,
            EntityName = entityName,
            EntityId = entityId,
            Timestamp = DateTime.UtcNow,
            IpAddress = ipAddress
        });

        await db.SaveChangesAsync(cancellationToken);
    }

    private static Guid? TryParseGuid(string? value) =>
        Guid.TryParse(value, out var guid) ? guid : null;
}
