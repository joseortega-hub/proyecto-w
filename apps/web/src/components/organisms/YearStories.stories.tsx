import type { Meta, StoryObj } from '@storybook/react-vite'
import { YearStoryCard } from '@/components/molecules'
import { YearStories } from './YearStories'

const card = (text: string, color: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="100%" height="100%" fill="${color}"/><text x="96" y="300" font-size="82" fill="#fff" font-family="sans-serif">${text}</text></svg>`)
const cards = [card('Tu año', '#241b4d'), card('Lo tuyo es el cine', '#3b1d3a'), card('Datos curiosos', '#16122b')]

const meta = {
  title: 'Organisms/YearStories',
  component: YearStories,
  args: {
    count: cards.length,
    renderCard: (i: number) => <YearStoryCard key={i} src={cards[i]} alt={`Tarjeta ${i + 1}`} position={`${i + 1} de ${cards.length}`} onShare={() => {}} />,
  },
} satisfies Meta<typeof YearStories>
export default meta
type Story = StoryObj<typeof meta>

export const TresTarjetas: Story = {}
