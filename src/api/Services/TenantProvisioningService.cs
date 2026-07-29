using System.Text.RegularExpressions;
using Api.Data;
using Api.Dtos;
using Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class TenantProvisioningService(
    AppDbContext db,
    PasswordHasher<User> passwordHasher,
    IAuditLogger auditLogger)
{
    public async Task<(User Admin, Tenant Tenant)?> RegisterAsync(
        RegisterTenantRequest request,
        CancellationToken cancellationToken = default)
    {
        var tenantName = request.TenantName.Trim();
        var username = request.AdminUsername.Trim();
        var email = request.AdminEmail.Trim().ToLowerInvariant();
        var password = request.AdminPassword;

        if (string.IsNullOrWhiteSpace(tenantName)
            || string.IsNullOrWhiteSpace(username)
            || string.IsNullOrWhiteSpace(email)
            || string.IsNullOrWhiteSpace(password))
        {
            throw new ArgumentException("TenantName, AdminUsername, AdminEmail, and AdminPassword are required.");
        }

        var usernameTaken = await db.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.Username == username && !u.IsDeleted, cancellationToken);

        var emailTaken = await db.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.Email == email && !u.IsDeleted, cancellationToken);

        if (usernameTaken || emailTaken)
        {
            return null;
        }

        var tenantId = Guid.NewGuid();
        var slug = await CreateUniqueSlugAsync(tenantName, cancellationToken);

        var tenant = new Tenant
        {
            Id = tenantId,
            Name = tenantName,
            Slug = slug,
            Status = TenantStatuses.Active,
            CreatedAt = DateTime.UtcNow
        };

        var admin = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Username = username,
            Email = email,
            Role = UserRoles.Admin,
            CreatedAt = DateTime.UtcNow
        };
        admin.PasswordHash = passwordHasher.HashPassword(admin, password);

        var sampleCustomer = new Customer
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = $"{tenantName} Sample Customer",
            Email = $"sample@{slug}.example",
            CreatedAt = DateTime.UtcNow
        };

        var sampleSubscription = new Subscription
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerId = sampleCustomer.Id,
            Status = "Active",
            Tier = "Starter",
            StartDate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        db.Tenants.Add(tenant);
        db.Users.Add(admin);
        db.Customers.Add(sampleCustomer);
        db.Subscriptions.Add(sampleSubscription);
        await db.SaveChangesAsync(cancellationToken);

        await auditLogger.LogAsync(
            AuditActions.AuthRegister,
            nameof(Tenant),
            tenant.Id,
            tenantId,
            admin.Id,
            admin.Username,
            cancellationToken);

        return (admin, tenant);
    }

    private async Task<string> CreateUniqueSlugAsync(string tenantName, CancellationToken cancellationToken)
    {
        var baseSlug = ToSlug(tenantName);
        var slug = baseSlug;
        var suffix = 1;

        while (await db.Tenants.IgnoreQueryFilters().AnyAsync(t => t.Slug == slug, cancellationToken))
        {
            slug = $"{baseSlug}-{suffix++}";
        }

        return slug;
    }

    private static string ToSlug(string value)
    {
        var slug = Regex.Replace(value.Trim().ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(slug) ? Guid.NewGuid().ToString("N")[..8] : slug;
    }
}
