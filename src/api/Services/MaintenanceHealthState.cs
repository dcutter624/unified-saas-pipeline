namespace Api.Services;

public interface IMaintenanceHealthState
{
    DateTime WorkerStartedAtUtc { get; }
    bool IsWorkerRunning { get; }
    DateTime? LastAttemptAtUtc { get; }
    DateTime? LastSuccessAtUtc { get; }
    string? LastTrigger { get; }
    string? LastError { get; }
    int SuccessCount { get; }
    int FailureCount { get; }
    void MarkWorkerStarted();
    void MarkAttempt(string trigger);
    void MarkSuccess(string trigger);
    void MarkFailure(string trigger, Exception exception);
}

public sealed class MaintenanceHealthState : IMaintenanceHealthState
{
    private readonly object _gate = new();

    public DateTime WorkerStartedAtUtc { get; private set; } = DateTime.UtcNow;
    public bool IsWorkerRunning { get; private set; }
    public DateTime? LastAttemptAtUtc { get; private set; }
    public DateTime? LastSuccessAtUtc { get; private set; }
    public string? LastTrigger { get; private set; }
    public string? LastError { get; private set; }
    public int SuccessCount { get; private set; }
    public int FailureCount { get; private set; }

    public void MarkWorkerStarted()
    {
        lock (_gate)
        {
            WorkerStartedAtUtc = DateTime.UtcNow;
            IsWorkerRunning = true;
        }
    }

    public void MarkAttempt(string trigger)
    {
        lock (_gate)
        {
            LastAttemptAtUtc = DateTime.UtcNow;
            LastTrigger = trigger;
            IsWorkerRunning = true;
        }
    }

    public void MarkSuccess(string trigger)
    {
        lock (_gate)
        {
            LastAttemptAtUtc = DateTime.UtcNow;
            LastSuccessAtUtc = DateTime.UtcNow;
            LastTrigger = trigger;
            LastError = null;
            SuccessCount++;
            IsWorkerRunning = true;
        }
    }

    public void MarkFailure(string trigger, Exception exception)
    {
        lock (_gate)
        {
            LastAttemptAtUtc = DateTime.UtcNow;
            LastTrigger = trigger;
            LastError = exception.Message;
            FailureCount++;
            IsWorkerRunning = true;
        }
    }
}
