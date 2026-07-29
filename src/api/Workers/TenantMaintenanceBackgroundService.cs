using Api.Services;
using Microsoft.Extensions.Options;

namespace Api.Workers;

/// <summary>
/// Recurring tenant maintenance: MRR snapshots, soft-delete purge, past-due suspensions.
/// </summary>
public sealed class TenantMaintenanceBackgroundService(
    IServiceScopeFactory scopeFactory,
    IOptions<MaintenanceOptions> options,
    IMaintenanceHealthState healthState,
    ILogger<TenantMaintenanceBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        healthState.MarkWorkerStarted();

        var startupDelay = TimeSpan.FromMinutes(Math.Max(0, options.Value.StartupDelayMinutes));
        if (startupDelay > TimeSpan.Zero)
        {
            try
            {
                await Task.Delay(startupDelay, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
        }

        logger.LogInformation(
            "Tenant maintenance worker started. Interval={IntervalHours}h",
            options.Value.IntervalHours);

        using var timer = new PeriodicTimer(ResolveInterval());

        await RunOnceSafeAsync("startup", stoppingToken);

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await RunOnceSafeAsync("schedule", stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // graceful shutdown
        }
    }

    private TimeSpan ResolveInterval()
    {
        var hours = options.Value.IntervalHours;
        if (hours <= 0)
        {
            hours = 24;
        }

        return TimeSpan.FromHours(Math.Max(0.05, hours));
    }

    private async Task RunOnceSafeAsync(string trigger, CancellationToken cancellationToken)
    {
        healthState.MarkAttempt(trigger);
        try
        {
            using var scope = scopeFactory.CreateScope();
            var maintenance = scope.ServiceProvider.GetRequiredService<TenantMaintenanceService>();
            await maintenance.RunAsync(trigger, cancellationToken);
            healthState.MarkSuccess(trigger);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("already in progress", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning("Skipping overlapping maintenance run ({Trigger}).", trigger);
            healthState.MarkSuccess(trigger);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            healthState.MarkFailure(trigger, ex);
            logger.LogError(ex, "Tenant maintenance run failed ({Trigger}).", trigger);
        }
    }
}
