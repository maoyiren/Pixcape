'use client'

import type { ReactNode } from 'react'
import { MantineProvider, createTheme } from '@mantine/core'

const theme = createTheme({
  primaryColor: 'green',
  defaultRadius: 'sm',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
})

export function CdpcMantineProvider({ children }: { children: ReactNode }) {
  return <MantineProvider theme={theme}>{children}</MantineProvider>
}
