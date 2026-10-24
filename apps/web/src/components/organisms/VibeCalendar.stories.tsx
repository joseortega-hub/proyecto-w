import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { StoryDay } from '@/lib/home-types'
import { buildCalendar, currentStreak } from '@/lib/story'
import { VibeCalendar } from './VibeCalendar'

const now = new Date(2026, 9, 24, 21, 0)
const day = (daysAgo: number, domainId: string, scales: Record<string, number>): StoryDay => {
  const at = new Date(now)
  at.setDate(now.getDate() - daysAgo)
  return { id: `s${daysAgo}`, domainId, at: at.toISOString(), title: 'Lista', scales, context: { franja: 'noche', diaSemana: 'sábado', finDeSemana: true, tiempo: daysAgo % 3 === 0 ? 'lluvia' : null } }
}
const days: StoryDay[] = [
  day(0, 'music', { energy: 0.2, positivity: 0.3 }),
  day(1, 'movies', { pace: 0.8, mood: 0.2 }),
  day(2, 'games', { intensity: 0.9, lightness: 0.8 }),
  day(3, 'music', { energy: 0.9, positivity: 0.9 }),
  day(6, 'books', { pace: 0.3, mood: 0.6 }),
  day(9, 'music', { energy: 0.5, positivity: 0.5 }),
  day(15, 'movies', { pace: 0.4, mood: 0.9 }),
  day(22, 'music', { energy: 0.1, positivity: 0.1 }),
  day(40, 'games', { intensity: 0.3, lightness: 0.3 }),
]
const cells = buildCalendar(days, now, 16)
const recent = days.slice(0, 3).map((d) => {
  const c = cells.find((x) => x.day?.id === d.id)!.day!
  return { id: d.id, domainId: d.domainId, domainName: d.domainId, icon: (d.domainId === 'movies' ? 'movies' : d.domainId === 'games' ? 'games' : d.domainId === 'books' ? 'books' : 'music') as 'music', dateLabel: 'sáb 24 oct', emoji: c.emoji, text: c.text, gradient: c.gradient, onOpen: fn() }
})

const meta = {
  title: 'Organisms/VibeCalendar',
  component: VibeCalendar,
  args: { cells, weeks: 16, streak: currentStreak(cells), recent },
  decorators: [(Story) => <div className="w-[350px] md:w-[640px]"><Story /></div>],
} satisfies Meta<typeof VibeCalendar>
export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {}
export const FewDays: Story = { args: { cells: buildCalendar(days.slice(0, 1), now, 16), streak: 1, recent: recent.slice(0, 1) } }
