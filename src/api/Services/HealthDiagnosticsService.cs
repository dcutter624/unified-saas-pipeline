using System.Diagnostics;
using Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Api.Services;

public record HealthCheckResponse(
    string Status,
    DateTime CheckedAtUtc,
    HealthDatabaseCheck Database,
    HealthWorkerCheck BackgroundWorker,
    HealthRateLimitingCheck RateLimiting,
    HealthSystemCheck System);

public record HealthDatabaseCheck(
    string Status,
    bool CanConnect,
    long LatencyMs,
    int TenantCount,
    string? Error);

public record HealthWorkerCheck(
    string Status,
    bool IsRunning,
    DateTime WorkerStartedAtUtc,
    DateTime? LastAttemptAtUtc,
    DateTime? LastSuccessAtUtc,
    string? LastTrigger,
    string? LastError,
    int SuccessCount,
    int FailureCount);

public record HealthRateLimitingCheck(
    string Status,
    bool Enabled,
    string GlobalPolicy,
    string AuthPolicy);

public record HealthSystemCheck(
    string Environment,
    string Framework,
    double UptimeSeconds,
    long WorkingSetBytes,
    long ManagedMemoryBytes,
    int ProcessorCount,
    string MachineName);

public class HealthDiagnosticsService(
    AppDbContext db,
    IMaintenanceHealthState maintenanceHealth,
    IHostEnvironment environment,
    IOptions<MaintenanceOptions> maintenanceOptions)
{
    private static readonly DateTime ProcessStartedUtc =
        Process.GetCurrentProcess().StartTime.ToUniversalTime();

    public async Task<(HealthCheckResponse Response, bool Healthy)> CheckAsync(
        CancellationToken cancellationToken = default)
    {
        var database = await CheckDatabaseAsync(cancellationToken);
        var worker = CheckWorker();
        var rateLimiting = CheckRateLimiting();
        var system = CheckSystem();

        var healthy = database.Status == "Healthy" && worker.Status is "Healthy" or "Degraded";
        var status = healthy
            ? worker.Status == "Degraded" || rateLimiting.Status == "Degraded"
                ? "Degraded"
                : "Healthy"
            : "Unhealthy";

        var response = new HealthCheckResponse(
            status,
            DateTime.UtcNow,
            database,
            worker,
            rateLimiting,
            system);

        return (response, healthy);
    }

    private async Task<HealthDatabaseCheck> CheckDatabaseAsync(CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var canConnect = await db.Database.CanConnectAsync(cancellationToken);
            if (!canConnect)
            {
                sw.Stop();
                return new HealthDatabaseCheck("Unhealthy", false, sw.ElapsedMilliseconds, 0, "Database reported CanConnect=false.");
            }

            // Lightweight probe that also exercises EF query pipeline / InMemory store.
            var tenantCount = await db.Tenants
                .IgnoreQueryFilters()
                .CountAsync(cancellationToken);

            sw.Stop();
            return new HealthDatabaseCheck("Healthy", true, sw.ElapsedMilliseconds, tenantCount, null);
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new HealthDatabaseCheck("Unhealthy", false, sw.ElapsedMilliseconds, 0, ex.Message);
        }
    }

    private HealthWorkerCheck CheckWorker()
    {
        var lastSuccess = maintenanceHealth.LastSuccessAtUtc;
        var interval = TimeSpan.FromHours(Math.Max(0.05, maintenanceOptions.Value.IntervalHours));
        var staleThreshold = interval + TimeSpan.FromHours(1);

        string status;
        if (!string.IsNullOrWhiteSpace(maintenanceHealth.LastError)
            && (lastSuccess is null || maintenanceHealth.LastAttemptAtUtc > lastSuccess))
        {
            status = "Degraded";
        }
        else if (lastSuccess is null)
        {
            // Worker may still be in startup delay.
            status = maintenanceHealth.IsWorkerRunning ? "Healthy" : "Degraded";
        }
        else if (DateTime.UtcNow - lastSuccess > staleThreshold)
        {
            status = "Degraded";
        }
        else
        {
            status = "Healthy";
        }

        return new HealthWorkerCheck(
            status,
            maintenanceHealth.IsWorkerRunning,
            maintenanceHealth.WorkerStartedAtUtc,
            maintenanceHealth.LastAttemptAtUtc,
            maintenanceHealth.LastSuccessAtUtc,
            maintenanceHealth.LastTrigger,
            maintenanceHealth.LastError,
            maintenanceHealth.SuccessCount,
            maintenanceHealth.FailureCount);
    }

    private static HealthRateLimitingCheck CheckRateLimiting() =>
        new(
            "Healthy",
            true,
            "global:120/min/IP",
            "auth:10/min/IP");

    private HealthSystemCheck CheckSystem()
    {
        using var process = Process.GetCurrentProcess();
        return new HealthSystemCheck(
            environment.EnvironmentName,
            Environment.Version.ToString(),
            Math.Round((DateTime.UtcNow - ProcessStartedUtc).TotalSeconds, 1),
            process.WorkingSet64,
            GC.GetTotalMemory(forceFullCollection: false),
            Environment.ProcessorCount,
            Environment.MachineName);
    }
}
