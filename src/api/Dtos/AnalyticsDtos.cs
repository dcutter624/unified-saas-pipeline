namespace Api.Dtos;

public record AnalyticsSummaryResponse(
    string Period,
    DateTime GeneratedAtUtc,
    DateTime RangeStartUtc,
    DateTime RangeEndUtc,
    AnalyticsKpis Kpis,
    IReadOnlyList<StatusDistributionItem> StatusDistribution,
    IReadOnlyList<AnalyticsSeriesPoint> Series);

public record AnalyticsKpis(
    decimal TotalMrr,
    decimal Arpu,
    decimal ChurnRate,
    decimal InactivePercentage,
    int ActiveCustomers,
    int TotalCustomers,
    int ActiveSubscriptions,
    int TotalSubscriptions,
    decimal? MrrTrendPercent,
    decimal? CustomerTrendPercent);

public record StatusDistributionItem(string Status, int Count);

public record AnalyticsSeriesPoint(
    string Bucket,
    string Label,
    decimal Mrr,
    int NewCustomers,
    int CumulativeCustomers,
    int ActiveSubscriptions);
