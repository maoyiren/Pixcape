'use client'

import type { ReactNode } from 'react'
import { MantineProvider, createTheme } from '@mantine/core'

const theme = createTheme({
  primaryColor: 'cdpc',
  defaultRadius: 'sm',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: '700',
  },
  colors: {
    cdpc: ['#f2f6ff', '#e2ebff', '#c7d8ff', '#a8c7ff', '#8db2f5', '#6e96dc', '#5278bd', '#3d5d98', '#2c456f', '#1c2f50'],
  },
  components: {
    Button: { defaultProps: { radius: 'sm' } },
    TextInput: { defaultProps: { radius: 'sm' } },
    PasswordInput: { defaultProps: { radius: 'sm' } },
    Textarea: { defaultProps: { radius: 'sm' } },
    Select: { defaultProps: { radius: 'sm' } },
    Card: { defaultProps: { radius: 'md', withBorder: true } },
    Paper: { defaultProps: { radius: 'md' } },
    Alert: { defaultProps: { radius: 'md' } },
  },
})

export function CdpcMantineProvider({ children }: { children: ReactNode }) {
  return <MantineProvider theme={theme} defaultColorScheme="dark">{children}</MantineProvider>
}
