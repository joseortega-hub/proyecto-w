import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/templates/AppShell'
import { DomainGate } from '@/components/templates/DomainGate'
import { Toaster } from '@/components/ui/sonner'
import { DomainPickerPage } from '@/pages/DomainPickerPage'
import { HomePage } from '@/pages/HomePage'
import { InterviewPage } from '@/pages/InterviewPage'
import { ItemPage } from '@/pages/ItemPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { ListsPage } from '@/pages/ListsPage'
import { PlayerPage } from '@/pages/PlayerPage'
import { ResultPage } from '@/pages/ResultPage'
import { TastePage } from '@/pages/TastePage'
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
            {/* "/" es el selector de temáticas. */}
            <Route index element={<DomainPickerPage />} />
            {/* Cada temática tiene su biblioteca, sus listas y sus entrevistas. */}
            <Route path=":domain" element={<DomainGate />}>
              <Route element={<AppShell />}>
                <Route index element={<HomePage />} />
                <Route path="resultado/:id" element={<ResultPage />} />
                <Route path="listas" element={<ListsPage />} />
                <Route path="gustos" element={<TastePage />} />
                <Route path="biblioteca" element={<LibraryPage />} />
                <Route path="biblioteca/:itemId" element={<ItemPage key="ficha" />} />
              </Route>
              <Route path="entrevista" element={<InterviewPage key="nueva" />} />
              <Route path="entrevista/:sesion" element={<InterviewPage key="sesion" />} />
            </Route>
            {/* El reproductor es global: la música sigue al cambiar de dominio. */}
            <Route path="reproductor" element={<PlayerPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" />
      </PlayerProvider>
    </QueryClientProvider>
  )
}
