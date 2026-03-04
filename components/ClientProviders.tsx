'use client'

import { ThemeProvider } from '@/components/builder/core/hooks/useThemeContext'

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
