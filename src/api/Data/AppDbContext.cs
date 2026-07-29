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

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.Name).IsRequired();
            entity.Property(t => t.Slug).IsRequired();
            entity.Property(t => t.Status).IsRequired();
            entity.HasIndex(t => t.Slug).IsUnique();
            entity.HasQueryFilter(t =>
                !t.IsDeleted && (CurrentTenantId == Guid.Empty || t.Id == CurrentTenantId));
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
            entity.Property(u => u.Email).IsRequired();
            entity.Property(u => u.PasswordHash).IsRequired();
            entity.Property(u => u.Role).IsRequired();
            entity.HasIndex(u => u.Username).IsUnique();
            entity.HasIndex(u => u.Email).IsUnique();

            entity.HasOne(u => u.Tenant)
                .WithMany(t => t.Users)
                .HasForeignKey(u => u.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(u => !u.IsDeleted && u.TenantId == CurrentTenantId);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.Property(a => a.Action).IsRequired().HasMaxLength(64);
            entity.Property(a => a.EntityName).IsRequired().HasMaxLength(128);
            entity.Property(a => a.Username).IsRequired().HasMaxLength(128);
            entity.Property(a => a.IpAddress).HasMaxLength(64);
            entity.HasIndex(a => new { a.TenantId, a.Timestamp });

            entity.HasOne(a => a.Tenant)
                .WithMany()
                .HasForeignKey(a => a.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(a => a.TenantId == CurrentTenantId);
        });
    }

    public override int SaveChanges()
    {
        ApplySoftDeletes();
        ApplyTenantIdOnInsert();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplySoftDeletes();
        ApplyTenantIdOnInsert();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void ApplySoftDeletes()
    {
        var utcNow = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<Tenant>())
        {
            if (entry.State != EntityState.Deleted)
            {
                continue;
            }

            entry.State = EntityState.Modified;
            entry.Entity.IsDeleted = true;
            entry.Entity.DeletedAt = utcNow;
            if (!TenantStatuses.IsDisabled(entry.Entity.Status))
            {
                entry.Entity.Status = TenantStatuses.Inactive;
            }
        }

        foreach (var entry in ChangeTracker.Entries<User>())
        {
            if (entry.State != EntityState.Deleted)
            {
                continue;
            }

            entry.State = EntityState.Modified;
            entry.Entity.IsDeleted = true;
            entry.Entity.DeletedAt = utcNow;
        }
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
