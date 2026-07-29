namespace Api.Dtos;

public record RegisterTenantRequest(
    string TenantName,
    string AdminUsername,
    string AdminEmail,
    string AdminPassword);
