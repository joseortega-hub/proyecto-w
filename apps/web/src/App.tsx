import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/templates/AppShell'
import { DomainGate } from '@/components/templates/DomainGate'
import { Toaster } from '@/components/ui/sonner'
import { DEFAULT_DOMAIN } from '@/lib/domain'
import { HomePage } from '@/pages/HomePage'
import { InterviewPage } from '@/pages/InterviewPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { ListsPage } from '@/pages/ListsPage'
import { PlayerPage } from '@/pages/PlayerPage'
import { ResultPage } from '@/pages/ResultPage'
import { PlayerProvider } from '@/player/player-context'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>
        <BrowserRouter>
          <Routes>
            {/* Con un solo dominio, "/" entra directamente; con varios, aquí irá el selector de dominio. */}
            <Route index element={<Navigate to={`/${DEFAULT_DOMAIN}`} replace />} />
            {/* Cada temática tiene su biblioteca, sus listas y sus entrevistas. */}
            <Route path=":domain" element={<DomainGate />}>
              <Route element={<AppShell />}>
                <Route index element={<HomePage />} />
                <Route path="resultado/:id" element={<ResultPage />} />
                <Route path="listas" element={<ListsPage />} />
                <Route path="biblioteca" element={<LibraryPage />} />
              </Route>
              <Route path="entrevista" element={<InterviewPage key="nueva" />} />
              <Route path="entrevista/:sesion" element={<InterviewPage key="sesion" />} />
            </Route>
            {/* El reproductor es global: la música sigue al cambiar de dominio. */}
            <Route path="reproductor" element={<PlayerPage />} />
            <Route path="*" element={<Navigate to={`/${DEFAULT_DOMAIN}`} replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" />
      </PlayerProvider>
    </QueryClientProvider>
  )
}
