import type { Meta, StoryObj } from '@storybook/react-vite'
import { vibeGradient } from '@/lib/vibe/vibe-color'
import { vibeTitle } from '@/lib/vibe/vibe-title'
import { VibeHeader } from './VibeHeader'

const make = (domain: string, scales: Record<string, number>, ctx?: Parameters<typeof vibeTitle>[2]) => {
  const drive = scales.energy ?? scales.intensity ?? scales.pace ?? 0.5
  const mood = scales.positivity ?? scales.lightness ?? scales.mood ?? 0.5
  return { title: vibeTitle(domain, scales, ctx), gradient: vibeGradient(drive, mood) }
}

const meta = {
  title: 'Molecules/VibeHeader',
  component: VibeHeader,
  args: make('music', { energy: 0.15, positivity: 0.5 }, { franja: 'noche', diaSemana: 'sábado' }),
  decorators: [(Story) => <div className="w-[340px] p-4"><Story /></div>],
} satisfies Meta<typeof VibeHeader>
export default meta
type Story = StoryObj<typeof meta>

export const ModoAfter: Story = {}
export const Viernes: Story = { args: make('music', { energy: 0.92, positivity: 0.92 }, { franja: 'noche', diaSemana: 'viernes', tiempo: 'despejado' }) }
export const Bajon: Story = { args: make('music', { energy: 0.2, positivity: 0.1 }, { franja: 'tarde', diaSemana: 'martes', tiempo: 'lluvia' }) }
export const Videojuegos: Story = { args: make('games', { intensity: 0.9, lightness: 0.2 }) }
export const Peliculas: Story = { args: make('movies', { pace: 0.2, mood: 0.8 }) }
export const Libros: Story = { args: make('books', { pace: 0.8, mood: 0.2 }) }
