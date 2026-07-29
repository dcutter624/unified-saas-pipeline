import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import {
  DataGrid,
  GridActionsCellItem,
  GridToolbar,
  type GridColDef,
  type GridRowParams,
} from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import BlockIcon from '@mui/icons-material/Block'
import type { DashboardRow } from '../../hooks/useDashboardData'

interface CustomersDataGridProps {
  rows: DashboardRow[]
  loading: boolean
  isAdmin: boolean
  onRefresh: () => void
  onAddCustomer: () => void
  onDeactivate: (row: DashboardRow) => Promise<void>
}

export function CustomersDataGrid({
  rows,
  loading,
  isAdmin,
  onRefresh,
  onAddCustomer,
  onDeactivate,
}: CustomersDataGridProps) {
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

  const columns = useMemo<GridColDef<DashboardRow>[]>(() => {
    const base: GridColDef<DashboardRow>[] = [
      { field: 'customerName', headerName: 'Customer', flex: 1, minWidth: 140 },
      { field: 'email', headerName: 'Email', flex: 1.2, minWidth: 180 },
      { field: 'subscriptionStatus', headerName: 'Status', width: 130 },
      { field: 'subscriptionTier', headerName: 'Tier', width: 130 },
      {
        field: 'startDate',
        headerName: 'Start',
        width: 120,
        valueFormatter: (value: string | null) =>
          value ? new Date(value).toLocaleDateString() : '—',
      },
    ]

    if (!isAdmin) {
      return base
    }

    return [
      ...base,
      {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 100,
        getActions: (params: GridRowParams<DashboardRow>) => {
          const canDeactivate =
            Boolean(params.row.subscriptionId) &&
            params.row.subscriptionStatus.toLowerCase() === 'active'

          return [
            <GridActionsCellItem
              key="deactivate"
              icon={<BlockIcon />}
              label="Deactivate"
              disabled={!canDeactivate || deactivatingId === params.row.id}
              onClick={() => {
                void (async () => {
                  setDeactivatingId(params.row.id)
                  try {
                    await onDeactivate(params.row)
                  } finally {
                    setDeactivatingId(null)
                  }
                })()
              }}
              showInMenu={false}
            />,
          ]
        },
      },
    ]
  }, [isAdmin, onDeactivate, deactivatingId])

  return (
    <Paper sx={{ height: 420, width: '100%', p: 1, display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1, py: 0.5 }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          Customers & Subscriptions
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<RefreshIcon />} onClick={onRefresh} disabled={loading}>
            Refresh
          </Button>
          {isAdmin && (
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onAddCustomer}
            >
              Add Customer
            </Button>
          )}
        </Stack>
      </Stack>

      {rows.length === 0 && !loading ? (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 2,
          }}
        >
          <Typography color="text.secondary" textAlign="center">
            No customers yet for this tenant.
            {isAdmin ? ' Use “Add Customer” to create the first record.' : ''}
          </Typography>
        </Box>
      ) : (
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          pageSizeOptions={[5, 10, 25]}
          initialState={{
            pagination: { paginationModel: { pageSize: 5, page: 0 } },
          }}
          disableRowSelectionOnClick
          filterMode="client"
          sortingMode="client"
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
  )
}
