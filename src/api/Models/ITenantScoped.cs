namespace Api.Models;

public interface ITenantScoped
{
    Guid TenantId { get; set; }
}
