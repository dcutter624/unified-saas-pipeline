using Api.Data;
using Api.Dtos;
using Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class AuditLogQueryService(AppDbContext db, ITenantService tenantService)
{
    public async Task<PagedAuditLogsResponse> GetPagedAsync(
        int page = 1,
        int pageSize = 25,
        string sortBy = "timestamp",
        string sortDir = "desc",
        CancellationToken cancellationToken = default)
    {
        tenantService.GetRequiredTenantId();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.AuditLogs.AsNoTracking();

        var descending = !string.Equals(sortDir, "asc", StringComparison.OrdinalIgnoreCase);
        query = (sortBy?.Trim().ToLowerInvariant()) switch
        {
            "action" => descending ? query.OrderByDescending(a => a.Action) : query.OrderBy(a => a.Action),
            "username" => descending ? query.OrderByDescending(a => a.Username) : query.OrderBy(a => a.Username),
            "entityname" => descending
                ? query.OrderByDescending(a => a.EntityName)
                : query.OrderBy(a => a.EntityName),
            _ => descending
                ? query.OrderByDescending(a => a.Timestamp)
                : query.OrderBy(a => a.Timestamp),
        };

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogResponse(
                a.Id,
                a.TenantId,
                a.UserId,
                a.Username,
                a.Action,
                a.EntityName,
                a.EntityId,
                a.Timestamp,
                a.IpAddress))
            .ToListAsync(cancellationToken);

        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);

        return new PagedAuditLogsResponse(items, page, pageSize, totalCount, totalPages);
    }
}
