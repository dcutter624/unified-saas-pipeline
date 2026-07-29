import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material'

const TIER_OPTIONS = ['Starter', 'Pro', 'Enterprise'] as const

interface AddCustomerDialogProps {
  open: boolean
  submitting: boolean
  onClose: () => void
  onSubmit: (payload: { name: string; email: string; tier: string }) => Promise<void>
}

export function AddCustomerDialog({ open, submitting, onClose, onSubmit }: AddCustomerDialogProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [tier, setTier] = useState<string>('Starter')
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})

  function reset() {
    setName('')
    setEmail('')
    setTier('Starter')
    setErrors({})
  }

  function handleClose() {
    if (submitting) {
      return
    }
    reset()
    onClose()
  }

  async function handleSubmit() {
    const next: { name?: string; email?: string } = {}
    if (!name.trim()) next.name = 'Name is required'
    if (!email.trim()) next.email = 'Email is required'
    setErrors(next)
    if (Object.keys(next).length > 0) {
      return
    }

    await onSubmit({ name: name.trim(), email: email.trim(), tier })
    reset()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Add Customer</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Customer name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={Boolean(errors.name)}
            helperText={errors.name}
            autoFocus
            fullWidth
          />
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={Boolean(errors.email)}
            helperText={errors.email}
            fullWidth
          />
          <TextField
            select
            label="Plan tier"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            fullWidth
          >
            {TIER_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? 'Saving…' : 'Add Customer'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
