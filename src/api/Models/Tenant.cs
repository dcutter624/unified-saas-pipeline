namespace Api.Models;

public class Tenant
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Customer> Customers { get; set; } = new List<Customer>();

    public ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();

    public ICollection<User> Users { get; set; } = new List<User>();
}
