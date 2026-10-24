import type { Meta, StoryObj } from '@storybook/react-vite'
import { ATTRIBUTES, SCALES, SOURCES } from '@/lib/vibe/vibe-fixtures'
import { VibeCard } from './VibeCard'

const meta = {
  title: 'Organisms/VibeCard',
  component: VibeCard,
  args: {
    domainId: 'music',
    attributes: ATTRIBUTES.music,
    scales: SCALES.musicAfter,
    sources: SOURCES,
    confidence: { energy: 0.9, positivity: 0.9, focus: 0.9, acoustic: 0.3, vocal: 0.3, dance: 0.3 },
    context: { franja: 'noche', diaSemana: 'sábado', tiempo: 'despejado' },
    adjusted: [],
  },
  decorators: [(Story) => <div className="w-[360px] p-3"><Story /></div>],
} satisfies Meta<typeof VibeCard>
export default meta
type Story = StoryObj<typeof meta>

export const MusicaAfter: Story = {}
export const MusicaFiesta: Story = {
  args: { scales: SCALES.musicParty, context: { franja: 'noche', diaSemana: 'viernes', finDeSemana: true, tiempo: 'despejado' } },
}
export const MusicaBajon: Story = { args: { scales: SCALES.musicBlue, context: { franja: 'tarde', diaSemana: 'martes', tiempo: 'lluvia' } } }
export const MusicaAjustada: Story = { args: { adjusted: ['energy'] } }
export const Reordenando: Story = { args: { pending: true, adjusted: ['energy'] } }
export const Videojuegos: Story = {
  args: {
    domainId: 'games',
    attributes: ATTRIBUTES.games,
    scales: SCALES.games,
    sources: { intensity: 'text', challenge: 'answer', story: 'taste', social: 'guess', length: 'context', lightness: 'answer' },
    confidence: {},
  },
}
export const Peliculas: Story = {
  args: {
    domainId: 'movies',
    attributes: ATTRIBUTES.movies,
    scales: SCALES.movies,
    sources: { pace: 'answer', mood: 'text', humor: 'answer', depth: 'taste', romance: 'guess', family: 'guess', era: 'context' },
    confidence: {},
  },
}
export const Libros: Story = {
  args: {
    domainId: 'books',
    attributes: ATTRIBUTES.books,
    scales: SCALES.books,
    sources: { lightness: 'answer', pace: 'text', mood: 'answer', fiction: 'taste', length: 'guess', era: 'context' },
    confidence: {},
  },
}
export const MiYouTube: Story = { args: { domainId: 'youtube' } }
export const Cargando: Story = { args: { scales: undefined } }
