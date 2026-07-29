using System.Text.Json;
using Api.Data;
using Api.Models;
using Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Api.Middleware;

public class TenantStatusMiddleware(RequestDelegate next)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task InvokeAsync(HttpContext context, AppDbContext db, ITenantService tenantService)
    {
        if (ShouldSkip(context) || context.User.Identity?.IsAuthenticated != true)
        {
            await next(context);
            return;
        }

        var tenantId = tenantService.TenantId;
        if (!tenantId.HasValue)
        {
            await next(context);
            return;
        }

        var status = await db.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(t => t.Id == tenantId.Value && !t.IsDeleted)
            .Select(t => t.Status)
            .FirstOrDefaultAsync();

        if (TenantStatuses.IsDisabled(status))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(
                JsonSerializer.Serialize(
                    new { message = "Tenant account is disabled. Please contact support." },
                    JsonOptions));
            return;
        }

        await next(context);
    }

    private static bool ShouldSkip(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        if (path.Equals("/", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/auth", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/seed", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        // Allow Admins to reactivate / change lifecycle status while disabled.
        if (HttpMethods.IsPatch(context.Request.Method)
            && path.Equals("/api/tenant/status", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return false;
    }
}
