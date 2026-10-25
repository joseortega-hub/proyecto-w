import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/templates/AppShell'
import { DomainGate } from '@/components/templates/DomainGate'
import { FeedbackSheet } from '@/components/organisms/FeedbackSheet'
import { Toaster } from '@/components/ui/sonner'
import { BajoElCapoPage } from '@/pages/BajoElCapoPage'
import { FolderReviewPage } from '@/pages/FolderReviewPage'
import { HomePage } from '@/pages/HomePage'
import { InterviewPage } from '@/pages/InterviewPage'
import { ItemPage } from '@/pages/ItemPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { ListsPage } from '@/pages/ListsPage'
import { PerreoArtistPage } from '@/pages/PerreoArtistPage'
import { PerreoArtistsPage } from '@/pages/PerreoArtistsPage'
import { PerreoReviewPage } from '@/pages/PerreoReviewPage'
import { PerreoTributePage } from '@/pages/PerreoTributePage'
import { PlayerPage } from '@/pages/PlayerPage'
import { ResultPage } from '@/pages/ResultPage'
import { StoryPage } from '@/pages/StoryPage'
import { TastePage } from '@/pages/TastePage'
import { TodayPage } from '@/pages/TodayPage'
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
            {/* "/" es «Hoy para ti»; "/historia", «Tu historia». */}
            <Route index element={<TodayPage />} />
            <Route path="historia" element={<StoryPage />} />
            {/* Cada temática tiene su biblioteca, sus listas y sus entrevistas. */}
            <Route path=":domain" element={<DomainGate />}>
              <Route element={<AppShell />}>
                <Route index element={<HomePage />} />
                <Route path="resultado/:id" element={<ResultPage />} />
                <Route path="listas" element={<ListsPage />} />
                <Route path="gustos" element={<TastePage />} />
                <Route path="revisar" element={<FolderReviewPage />} />
                <Route path="artistas" element={<PerreoArtistsPage />} />
                <Route path="por-revisar" element={<PerreoReviewPage />} />
                <Route path="artistas/:slug" element={<PerreoArtistPage />} />
                <Route path="homenaje/:slug" element={<PerreoTributePage />} />
                <Route path="biblioteca" element={<LibraryPage />} />
                <Route path="biblioteca/:itemId" element={<ItemPage key="ficha" />} />
              </Route>
              <Route path="entrevista" element={<InterviewPage key="nueva" />} />
              <Route path="entrevista/:sesion" element={<InterviewPage key="sesion" />} />
            </Route>
            {/* El reproductor es global: la música sigue al cambiar de dominio. */}
            <Route path="bajo-el-capo" element={<BajoElCapoPage />} />
            <Route path="reproductor" element={<PlayerPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          {/* Buzón de comentarios: uno para toda la app, se abre desde «Personalizar» o el menú. */}
          <FeedbackSheet />
        </BrowserRouter>
        <Toaster position="top-center" />
      </PlayerProvider>
    </QueryClientProvider>
  )
}
