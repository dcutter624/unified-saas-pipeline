namespace Api.Models;

public class User : ITenantScoped
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public string Username { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Tenant Tenant { get; set; } = null!;
}
