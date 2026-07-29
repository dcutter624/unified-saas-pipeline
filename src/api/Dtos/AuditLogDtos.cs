namespace Api.Dtos;

public record AuditLogResponse(
    Guid Id,
    Guid TenantId,
    Guid? UserId,
    string Username,
    string Action,
    string EntityName,
    Guid? EntityId,
    DateTime Timestamp,
    string? IpAddress);

public record PagedAuditLogsResponse(
    IReadOnlyList<AuditLogResponse> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);
