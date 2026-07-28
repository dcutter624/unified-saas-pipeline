using System.Text.Json.Serialization;
using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseInMemoryDatabase("UnifiedSaasPipeline"));

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod());
});

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});

var app = builder.Build();

app.UseCors();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await SeedDatabaseAsync(db);
}

app.MapGet("/", () => "Unified SaaS Pipeline API");

app.MapPost("/api/seed", async (AppDbContext db) =>
{
    if (await db.Tenants.AnyAsync())
    {
        return Results.Ok(new { message = "Database already seeded." });
    }

    await SeedDatabaseAsync(db);

    var tenant = await db.Tenants.FirstAsync();
    var customer = await db.Customers.FirstAsync();
    var subscription = await db.Subscriptions.FirstAsync();

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
});

app.MapGet("/api/tenants", GetTenantsAsync);
app.MapGet("/tenants", GetTenantsAsync);

app.Run();

static async Task<IResult> GetTenantsAsync(AppDbContext db)
{
    var tenants = await db.Tenants
        .Include(t => t.Customers)
        .Include(t => t.Subscriptions)
        .ToListAsync();

    return Results.Ok(tenants);
}

static async Task SeedDatabaseAsync(AppDbContext db)
{
    if (await db.Tenants.AnyAsync())
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

    db.Tenants.Add(tenant);
    db.Customers.Add(customer);
    db.Subscriptions.Add(subscription);
    await db.SaveChangesAsync();
}
