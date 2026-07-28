using System.Text;
using System.Text.Json.Serialization;
using Api.Data;
using Api.Dtos;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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

builder.Services.AddAuthorization();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

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
    await SeedDatabaseAsync(db);
}

app.MapGet("/", () => "Unified SaaS Pipeline API").AllowAnonymous();

app.MapPost("/api/auth/login", async (
    LoginRequest request,
    AppDbContext db,
    JwtTokenService tokenService) =>
{
    if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.Unauthorized();
    }

    // Bypass tenant filters — caller is not authenticated yet.
    var user = await db.Users
        .IgnoreQueryFilters()
        .AsNoTracking()
        .FirstOrDefaultAsync(u => u.Username == request.Username);

    if (user is null || !JwtTokenService.VerifyPassword(request.Password, user.PasswordHash))
    {
        return Results.Unauthorized();
    }

    var token = tokenService.CreateToken(user);

    return Results.Ok(new
    {
        token,
        tenantId = user.TenantId
    });
}).AllowAnonymous();

app.MapPost("/api/seed", async (AppDbContext db) =>
{
    if (await db.Tenants.IgnoreQueryFilters().AnyAsync())
    {
        return Results.Ok(new { message = "Database already seeded." });
    }

    await SeedDatabaseAsync(db);

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

static async Task SeedDatabaseAsync(AppDbContext db)
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
        PasswordHash = JwtTokenService.HashPassword("password"),
        CreatedAt = DateTime.UtcNow
    };

    db.Tenants.Add(tenant);
    db.Customers.Add(customer);
    db.Subscriptions.Add(subscription);
    db.Users.Add(user);
    await db.SaveChangesAsync();
}
