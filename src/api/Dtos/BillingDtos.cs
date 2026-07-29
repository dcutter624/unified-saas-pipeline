namespace Api.Dtos;

public record BillingSubscriptionResponse(
    Guid TenantId,
    string TenantName,
    string SubscriptionTier,
    string SubscriptionStatus,
    decimal MonthlyPrice,
    DateTime? CurrentPeriodEnd,
    string? StripeCustomerId,
    string? StripeSubscriptionId,
    IReadOnlyDictionary<string, bool> Features,
    IReadOnlyList<PlanCatalogItem> Plans);

public record PlanCatalogItem(
    string Tier,
    decimal MonthlyPrice,
    string Description,
    IReadOnlyList<string> Features,
    bool IsCurrent);

public record CreateCheckoutSessionRequest(
    string Tier,
    string? SuccessUrl = null,
    string? CancelUrl = null);

public record CheckoutSessionResponse(
    string SessionId,
    string CheckoutUrl,
    string Tier,
    string Mode,
    string Message);

public record StripeWebhookRequest(
    string Type,
    StripeWebhookData? Data = null);

public record StripeWebhookData(StripeWebhookObject? Object = null);

public record StripeWebhookObject(
    string? Id = null,
    string? Customer = null,
    string? Subscription = null,
    string? Status = null,
    Dictionary<string, string>? Metadata = null,
    long? CurrentPeriodEnd = null);
