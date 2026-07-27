using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<Customer> Customers => Set<Customer>();

    public DbSet<Subscription> Subscriptions => Set<Subscription>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.Name).IsRequired();
            entity.Property(t => t.Slug).IsRequired();
            entity.HasIndex(t => t.Slug).IsUnique();
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
        });
    }
}
