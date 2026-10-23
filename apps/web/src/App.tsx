import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from '@/components/templates/AppShell'
import { Toaster } from '@/components/ui/sonner'
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
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="resultado/:id" element={<ResultPage />} />
              <Route path="listas" element={<ListsPage />} />
              <Route path="biblioteca" element={<LibraryPage />} />
            </Route>
            <Route path="entrevista" element={<InterviewPage key="nueva" />} />
            <Route path="entrevista/:sesion" element={<InterviewPage key="sesion" />} />
            <Route path="reproductor" element={<PlayerPage />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" />
      </PlayerProvider>
    </QueryClientProvider>
  )
}
