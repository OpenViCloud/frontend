import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { RouterProvider, createAdminRouter } from './router'
import { AdminAuthGate } from './AdminAuthGate'
import { LanguageProvider } from '@/i18n/LanguageProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export function AdminApp() {
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <AdminAuthGate>
          <RouterProvider router={createAdminRouter()} />
          <Toaster richColors position="bottom-right" />
        </AdminAuthGate>
      </QueryClientProvider>
    </LanguageProvider>
  )
}
