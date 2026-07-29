using Api.Data;
using Api.Dtos;
using Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class TenantAdminService(
    AppDbContext db,
    ITenantService tenantService,
    PasswordHasher<User> passwordHasher)
{
    public async Task<TenantSettingsResponse?> GetSettingsAsync(CancellationToken cancellationToken = default)
    {
        var tenantId = tenantService.GetRequiredTenantId();
        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        return tenant is null ? null : ToSettingsResponse(tenant);
    }

    public async Task<TenantSettingsResponse?> UpdateSettingsAsync(
        UpdateTenantSettingsRequest request,
        CancellationToken cancellationToken = default)
    {
        var tenantId = tenantService.GetRequiredTenantId();
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(request.TenantName))
        {
            tenant.Name = request.TenantName.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            tenant.Status = request.Status.Trim();
        }

        if (request.PrimaryColor is not null)
        {
            tenant.PrimaryColor = string.IsNullOrWhiteSpace(request.PrimaryColor)
                ? null
                : request.PrimaryColor.Trim();
        }

        if (request.LogoUrl is not null)
        {
            tenant.LogoUrl = string.IsNullOrWhiteSpace(request.LogoUrl)
                ? null
                : request.LogoUrl.Trim();
        }

        await db.SaveChangesAsync(cancellationToken);
        return ToSettingsResponse(tenant);
    }

    public async Task<IReadOnlyList<TenantUserResponse>> ListUsersAsync(CancellationToken cancellationToken = default)
    {
        tenantService.GetRequiredTenantId();

        return await db.Users
            .AsNoTracking()
            .OrderBy(u => u.Username)
            .Select(u => new TenantUserResponse(u.Id, u.Username, u.Email, u.Role, u.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<(TenantUserResponse? User, string? Error)> CreateUserAsync(
        CreateTenantUserRequest request,
        CancellationToken cancellationToken = default)
    {
        var tenantId = tenantService.GetRequiredTenantId();

        var username = request.Username.Trim();
        var email = request.Email.Trim().ToLowerInvariant();
        var password = request.Password;
        var role = string.IsNullOrWhiteSpace(request.Role) ? UserRoles.User : request.Role.Trim();

        if (string.IsNullOrWhiteSpace(username)
            || string.IsNullOrWhiteSpace(email)
            || string.IsNullOrWhiteSpace(password))
        {
            return (null, "Username, Email, and Password are required.");
        }

        if (role is not (UserRoles.Admin or UserRoles.User))
        {
            return (null, $"Role must be '{UserRoles.Admin}' or '{UserRoles.User}'.");
        }

        var usernameTaken = await db.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.Username == username && !u.IsDeleted, cancellationToken);

        var emailTaken = await db.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.Email == email && !u.IsDeleted, cancellationToken);

        if (usernameTaken || emailTaken)
        {
            return (null, "Username or email is already taken.");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Username = username,
            Email = email,
            Role = role,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = passwordHasher.HashPassword(user, password);

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        return (new TenantUserResponse(user.Id, user.Username, user.Email, user.Role, user.CreatedAt), null);
    }

    public async Task<(TenantSettingsResponse? Settings, string? Error)> UpdateStatusAsync(
        UpdateTenantStatusRequest request,
        CancellationToken cancellationToken = default)
    {
        var tenantId = tenantService.GetRequiredTenantId();
        var status = request.Status?.Trim() ?? string.Empty;

        if (!TenantStatuses.Allowed.Contains(status))
        {
            return (null, $"Status must be one of: {string.Join(", ", TenantStatuses.Allowed)}.");
        }

        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return (null, "Tenant not found.");
        }

        tenant.Status = TenantStatuses.Allowed.First(s => s.Equals(status, StringComparison.OrdinalIgnoreCase));
        await db.SaveChangesAsync(cancellationToken);
        return (ToSettingsResponse(tenant), null);
    }

    private static TenantSettingsResponse ToSettingsResponse(Tenant tenant) =>
        new(
            tenant.Id,
            tenant.Name,
            tenant.Slug,
            tenant.CreatedAt,
            tenant.Status,
            tenant.PrimaryColor,
            tenant.LogoUrl);
}
