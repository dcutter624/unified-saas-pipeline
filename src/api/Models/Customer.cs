namespace Api.Models;

public class Customer
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public string Email { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Tenant Tenant { get; set; } = null!;

    public ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();
}
