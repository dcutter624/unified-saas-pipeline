using Api.Models;
using Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Api.Data;

public class AppDbContext : DbContext
{
    private readonly ITenantService _tenantService;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantService tenantService)
        : base(options)
    {
        _tenantService = tenantService;
    }

    /// <summary>
    /// Used by global query filters. Empty GUID means no tenant context (no rows match).
    /// </summary>
    public Guid CurrentTenantId => _tenantService.TenantId ?? Guid.Empty;

    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<Customer> Customers => Set<Customer>();

    public DbSet<Subscription> Subscriptions => Set<Subscription>();

    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.Name).IsRequired();
            entity.Property(t => t.Slug).IsRequired();
            entity.HasIndex(t => t.Slug).IsUnique();
            entity.HasQueryFilter(t => CurrentTenantId == Guid.Empty || t.Id == CurrentTenantId);
        });

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Email).IsRequired();
            entity.Property(c => c.Name).IsRequired();

            entity.HasOne(c => c.Tenant)
                .WithMany(t => t.Customers)
                .HasForeignKey(c => c.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(c => c.TenantId == CurrentTenantId);
        });

        modelBuilder.Entity<Subscription>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.Status).IsRequired();
            entity.Property(s => s.Tier).IsRequired();

            entity.HasOne(s => s.Tenant)
                .WithMany(t => t.Subscriptions)
                .HasForeignKey(s => s.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(s => s.Customer)
                .WithMany(c => c.Subscriptions)
                .HasForeignKey(s => s.CustomerId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(s => s.TenantId == CurrentTenantId);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.Property(u => u.Username).IsRequired();
            entity.Property(u => u.PasswordHash).IsRequired();
            entity.HasIndex(u => u.Username).IsUnique();

            entity.HasOne(u => u.Tenant)
                .WithMany(t => t.Users)
                .HasForeignKey(u => u.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(u => u.TenantId == CurrentTenantId);
        });
    }

    public override int SaveChanges()
    {
        ApplyTenantIdOnInsert();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTenantIdOnInsert();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void ApplyTenantIdOnInsert()
    {
        if (!_tenantService.IsResolved)
        {
            return;
        }

        var tenantId = _tenantService.TenantId!.Value;

        foreach (var entry in ChangeTracker.Entries<ITenantScoped>())
        {
            if (entry.State == EntityState.Added && entry.Entity.TenantId == Guid.Empty)
            {
                entry.Entity.TenantId = tenantId;
            }
        }
    }
}
