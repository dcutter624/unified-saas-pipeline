namespace Api.Dtos;

public record UpdateTenantSettingsRequest(
    string? TenantName,
    string? Status,
    string? PrimaryColor,
    string? LogoUrl);

public record CreateTenantUserRequest(
    string Username,
    string Email,
    string Password,
    string? Role = null);

public record TenantSettingsResponse(
    Guid TenantId,
    string TenantName,
    string Slug,
    DateTime CreatedAt,
    string Status,
    string? PrimaryColor,
    string? LogoUrl);

public record TenantUserResponse(
    Guid Id,
    string Username,
    string Email,
    string Role,
    DateTime CreatedAt);

public record UpdateTenantStatusRequest(string Status);
