namespace Api.Dtos;

public record MaintenanceRunResult(
    int SnapshotsRecorded,
    int PurgedRecords,
    int SuspendedTenants,
    DateTime StartedAtUtc,
    DateTime CompletedAtUtc,
    string Trigger);
