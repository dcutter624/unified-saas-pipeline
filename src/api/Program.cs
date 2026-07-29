using System.Text;
using System.Text.Json.Serialization;
using Api.Data;
using Api.Dtos;
using Api.Middleware;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantService, TenantService>();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseInMemoryDatabase("UnifiedSaasPipeline"));

builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddSingleton<PasswordHasher<User>>();
builder.Services.AddScoped<TenantProvisioningService>();
builder.Services.AddScoped<TenantAdminService>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("Jwt:Issuer is not configured.");
var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("Jwt:Audience is not configured.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole(UserRoles.Admin));
});

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<TenantStatusMiddleware>();

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (UnauthorizedAccessException)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
    }
});

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var passwordHasher = scope.ServiceProvider.GetRequiredService<PasswordHasher<User>>();
    await SeedDatabaseAsync(db, passwordHasher);
}

app.MapGet("/", () => "Unified SaaS Pipeline API").AllowAnonymous();

app.MapPost("/api/auth/login", async (
    LoginRequest request,
    AppDbContext db,
    JwtTokenService tokenService,
    PasswordHasher<User> passwordHasher) =>
{
    if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.Unauthorized();
    }

    // Bypass tenant filters — caller is not authenticated yet.
    var user = await db.Users
        .IgnoreQueryFilters()
        .AsNoTracking()
        .FirstOrDefaultAsync(u => u.Username == request.Username && !u.IsDeleted);

    if (user is null)
    {
        return Results.Unauthorized();
    }

    var verification = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
    if (verification == PasswordVerificationResult.Failed)
    {
        return Results.Unauthorized();
    }

    var tenant = await db.Tenants
        .IgnoreQueryFilters()
        .AsNoTracking()
        .FirstOrDefaultAsync(t => t.Id == user.TenantId && !t.IsDeleted);

    if (tenant is null)
    {
        return Results.Unauthorized();
    }

    // Login remains available for disabled tenants so Admins can reactivate via PATCH /api/tenant/status.
    var token = tokenService.CreateToken(user);

    return Results.Ok(new
    {
        token,
        tenantId = user.TenantId,
        tenantStatus = tenant.Status,
        message = TenantStatuses.IsDisabled(tenant.Status)
            ? "Tenant account is disabled. Please contact support."
            : null
    });
}).AllowAnonymous();

app.MapPost("/api/auth/register", async (
    RegisterTenantRequest request,
    TenantProvisioningService provisioning,
    JwtTokenService tokenService) =>
{
    try
    {
        var result = await provisioning.RegisterAsync(request);
        if (result is null)
        {
            return Results.BadRequest(new { message = "Username or email is already taken." });
        }

        var (admin, tenant) = result.Value;
        var token = tokenService.CreateToken(admin);

        return Results.Created($"/api/tenants", new
        {
            token,
            tenantId = tenant.Id,
            message = "Tenant registered successfully"
        });
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
}).AllowAnonymous();

app.MapPost("/api/seed", async (AppDbContext db, PasswordHasher<User> passwordHasher) =>
{
    if (await db.Tenants.IgnoreQueryFilters().AnyAsync())
    {
        return Results.Ok(new { message = "Database already seeded." });
    }

    await SeedDatabaseAsync(db, passwordHasher);

    var tenant = await db.Tenants.IgnoreQueryFilters().FirstAsync();
    var customer = await db.Customers.IgnoreQueryFilters().FirstAsync();
    var subscription = await db.Subscriptions.IgnoreQueryFilters().FirstAsync();

    return Results.Created("/api/tenants", new
    {
        TenantId = tenant.Id,
        TenantName = tenant.Name,
        CustomerId = customer.Id,
        CustomerName = customer.Name,
        SubscriptionId = subscription.Id,
        subscription.Status,
        subscription.Tier
    });
}).AllowAnonymous();

app.MapGet("/api/tenants", GetTenantsAsync).RequireAuthorization();
app.MapGet("/tenants", GetTenantsAsync).RequireAuthorization();

app.MapGet("/api/dashboard", async (AppDbContext db, ITenantService tenants) =>
{
    var tenantId = tenants.GetRequiredTenantId();

    var tenant = await db.Tenants
        .Include(t => t.Customers)
        .Include(t => t.Subscriptions)
        .FirstOrDefaultAsync(t => t.Id == tenantId);

    if (tenant is null)
    {
        return Results.NotFound();
    }

    return Results.Ok(new
    {
        tenant.Id,
        tenant.Name,
        tenant.Slug,
        CustomerCount = tenant.Customers.Count,
        SubscriptionCount = tenant.Subscriptions.Count,
        Customers = tenant.Customers,
        Subscriptions = tenant.Subscriptions
    });
}).RequireAuthorization();

app.MapGet("/api/metrics", async (AppDbContext db, ITenantService tenants) =>
{
    tenants.GetRequiredTenantId();

    var customerCount = await db.Customers.CountAsync();
    var subscriptionCount = await db.Subscriptions.CountAsync();
    var statusGroups = await db.Subscriptions
        .GroupBy(s => s.Status)
        .Select(g => new { Status = g.Key, Count = g.Count() })
        .ToListAsync();

    return Results.Ok(new
    {
        totalCustomers = customerCount,
        totalSubscriptions = subscriptionCount,
        statuses = statusGroups
    });
}).RequireAuthorization();

app.MapGet("/api/data", async (AppDbContext db, ITenantService tenants) =>
{
    tenants.GetRequiredTenantId();

    var customers = await db.Customers
        .AsNoTracking()
        .OrderBy(c => c.Name)
        .ToListAsync();

    return Results.Ok(customers);
}).RequireAuthorization();

app.MapPost("/api/data", async (
    CreateCustomerRequest request,
    AppDbContext db,
    ITenantService tenants) =>
{
    var tenantId = tenants.GetRequiredTenantId();

    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Email))
    {
        return Results.BadRequest(new { message = "Name and Email are required." });
    }

    var customer = new Customer
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Name = request.Name.Trim(),
        Email = request.Email.Trim().ToLowerInvariant(),
        CreatedAt = DateTime.UtcNow
    };

    var subscription = new Subscription
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        CustomerId = customer.Id,
        Status = "Active",
        Tier = string.IsNullOrWhiteSpace(request.Tier) ? "Starter" : request.Tier.Trim(),
        StartDate = DateTime.UtcNow,
        CreatedAt = DateTime.UtcNow
    };

    db.Customers.Add(customer);
    db.Subscriptions.Add(subscription);
    await db.SaveChangesAsync();

    return Results.Created($"/api/data/{customer.Id}", new
    {
        customer.Id,
        customer.Name,
        customer.Email,
        SubscriptionId = subscription.Id,
        subscription.Status,
        subscription.Tier
    });
}).RequireAuthorization("AdminOnly");

app.MapPatch("/api/subscriptions/{subscriptionId:guid}/status", async (
    Guid subscriptionId,
    UpdateTenantStatusRequest request,
    AppDbContext db,
    ITenantService tenants) =>
{
    tenants.GetRequiredTenantId();

    var status = request.Status?.Trim() ?? string.Empty;
    if (string.IsNullOrWhiteSpace(status))
    {
        return Results.BadRequest(new { message = "Status is required." });
    }

    var subscription = await db.Subscriptions.FirstOrDefaultAsync(s => s.Id == subscriptionId);
    if (subscription is null)
    {
        return Results.NotFound();
    }

    subscription.Status = status;
    if (status.Equals("Inactive", StringComparison.OrdinalIgnoreCase)
        || status.Equals("Cancelled", StringComparison.OrdinalIgnoreCase))
    {
        subscription.EndDate ??= DateTime.UtcNow;
    }

    await db.SaveChangesAsync();
    return Results.Ok(subscription);
}).RequireAuthorization("AdminOnly");

var tenantApi = app.MapGroup("/api/tenant").RequireAuthorization();

tenantApi.MapGet("/settings", async (TenantAdminService admin) =>
{
    var settings = await admin.GetSettingsAsync();
    return settings is null ? Results.NotFound() : Results.Ok(settings);
});

var tenantAdmin = app.MapGroup("/api/tenant")
    .RequireAuthorization("AdminOnly");

tenantAdmin.MapPut("/settings", async (UpdateTenantSettingsRequest request, TenantAdminService admin) =>
{
    var settings = await admin.UpdateSettingsAsync(request);
    return settings is null ? Results.NotFound() : Results.Ok(settings);
});

tenantAdmin.MapPatch("/status", async (UpdateTenantStatusRequest request, TenantAdminService admin) =>
{
    var (settings, error) = await admin.UpdateStatusAsync(request);
    if (error is not null)
    {
        return error == "Tenant not found."
            ? Results.NotFound(new { message = error })
            : Results.BadRequest(new { message = error });
    }

    return Results.Ok(settings);
});

tenantAdmin.MapGet("/users", async (TenantAdminService admin) =>
{
    var users = await admin.ListUsersAsync();
    return Results.Ok(users);
});

tenantAdmin.MapPost("/users", async (CreateTenantUserRequest request, TenantAdminService admin) =>
{
    var (user, error) = await admin.CreateUserAsync(request);
    if (error is not null)
    {
        return Results.BadRequest(new { message = error });
    }

    return Results.Created($"/api/tenant/users/{user!.Id}", user);
});

app.Run();

static async Task<IResult> GetTenantsAsync(AppDbContext db, ITenantService tenants)
{
    tenants.GetRequiredTenantId();

    var tenantList = await db.Tenants
        .Include(t => t.Customers)
        .Include(t => t.Subscriptions)
        .ToListAsync();

    return Results.Ok(tenantList);
}

static async Task SeedDatabaseAsync(AppDbContext db, PasswordHasher<User> passwordHasher)
{
    if (await db.Tenants.IgnoreQueryFilters().AnyAsync())
    {
        return;
    }

    var tenant = new Tenant
    {
        Id = Guid.NewGuid(),
        Name = "Acme Corp",
        Slug = "acme-corp",
        Status = TenantStatuses.Active,
        CreatedAt = DateTime.UtcNow
    };

    var customer = new Customer
    {
        Id = Guid.NewGuid(),
        TenantId = tenant.Id,
        Name = "John Doe",
        Email = "john.doe@acme.com",
        CreatedAt = DateTime.UtcNow
    };

    var subscription = new Subscription
    {
        Id = Guid.NewGuid(),
        TenantId = tenant.Id,
        CustomerId = customer.Id,
        Status = "Active",
        Tier = "Pro Tier",
        StartDate = DateTime.UtcNow,
        CreatedAt = DateTime.UtcNow
    };

    var user = new User
    {
        Id = Guid.NewGuid(),
        TenantId = tenant.Id,
        Username = "admin",
        Email = "admin@acme.com",
        Role = UserRoles.Admin,
        CreatedAt = DateTime.UtcNow
    };
    user.PasswordHash = passwordHasher.HashPassword(user, "password");

    db.Tenants.Add(tenant);
    db.Customers.Add(customer);
    db.Subscriptions.Add(subscription);
    db.Users.Add(user);
    await db.SaveChangesAsync();
}
