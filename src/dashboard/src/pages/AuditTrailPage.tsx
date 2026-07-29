import { useMemo } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { DataGrid, GridToolbar, type GridColDef } from '@mui/x-data-grid'
import RefreshIcon from '@mui/icons-material/Refresh'
import type { AuditLogItem } from '../api/auditApi'
import { useAuditLogs } from '../hooks/useAuditLogs'

function actionChipColor(
  action: string,
): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error' {
  const normalized = action.toUpperCase()
  if (normalized.startsWith('AUTH_')) {
    return 'info'
  }
  if (normalized.includes('CREATE')) {
    return 'success'
  }
  if (normalized.includes('UPDATE') || normalized.includes('STATUS')) {
    return 'warning'
  }
  return 'default'
}

function actionLabel(action: string): string {
  if (action.startsWith('AUTH_')) {
    return 'AUTH'
  }
  if (action.includes('CREATE')) {
    return 'CREATE'
  }
  if (action.includes('UPDATE')) {
    return 'UPDATE'
  }
  return action
}

export default function AuditTrailPage() {
  const {
    rows,
    loading,
    error,
    totalCount,
    paginationModel,
    setPaginationModel,
    refresh,
    setError,
  } = useAuditLogs(true)

  const columns = useMemo<GridColDef<AuditLogItem>[]>(
    () => [
      {
        field: 'timestamp',
        headerName: 'Timestamp',
        flex: 1.1,
        minWidth: 180,
        valueFormatter: (value: string) =>
          value
            ? new Date(value).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : '—',
      },
      {
        field: 'action',
        headerName: 'Action',
        width: 120,
        sortable: false,
        renderCell: (params) => (
          <Chip
            size="small"
            label={actionLabel(params.value as string)}
            color={actionChipColor(params.value as string)}
            variant="outlined"
            title={params.value as string}
          />
        ),
      },
      {
        field: 'actionDetail',
        headerName: 'Detail',
        flex: 1.2,
        minWidth: 200,
        sortable: false,
        valueGetter: (_value, row) => row.action,
      },
      {
        field: 'username',
        headerName: 'User',
        flex: 0.8,
        minWidth: 120,
      },
      {
        field: 'entityName',
        headerName: 'Entity',
        width: 130,
      },
      {
        field: 'entityId',
        headerName: 'Entity Id',
        flex: 1,
        minWidth: 160,
        valueFormatter: (value: string | null) => value ?? '—',
      },
      {
        field: 'ipAddress',
        headerName: 'IP',
        width: 130,
        valueFormatter: (value: string | null) => value ?? '—',
      },
    ],
    [],
  )

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Audit Trail
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Tenant-scoped history of authentication and data changes
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={refresh} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ height: 560, width: '100%', p: 1 }}>
        {rows.length === 0 && !loading ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: 2,
            }}
          >
            <Typography color="text.secondary" textAlign="center">
              No audit events yet. Sign in, add a customer, or update settings to generate entries.
            </Typography>
          </Box>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            rowCount={totalCount}
            paginationMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[10, 25, 50]}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 300 },
              },
            }}
            sx={{
              border: 0,
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: 'action.hover',
              },
            }}
          />
        )}
      </Paper>
    </Container>
  )
}
