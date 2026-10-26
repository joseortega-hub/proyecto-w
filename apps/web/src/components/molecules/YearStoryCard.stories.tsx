import type { Meta, StoryObj } from '@storybook/react-vite'
import { YearStoryCard } from './YearStoryCard'

const placeholder =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="100%" height="100%" fill="#16122b"/><text x="96" y="300" font-size="82" fill="#fff" font-family="sans-serif">Lo tuyo es el cine</text></svg>',
  )

const meta = {
  title: 'Molecules/YearStoryCard',
  component: YearStoryCard,
  args: { src: placeholder, alt: 'Lo tuyo es el cine. Películas: 12 entrevistas', position: '2 de 7', onShare: () => {} },
} satisfies Meta<typeof YearStoryCard>
export default meta
type Story = StoryObj<typeof meta>

export const Lista: Story = {}
export const Cargando: Story = { args: { src: undefined } }
export const Compartiendo: Story = { args: { sharing: true } }
