namespace Api.Dtos;

public record CreateCustomerRequest(string Name, string Email, string? Tier = null);
