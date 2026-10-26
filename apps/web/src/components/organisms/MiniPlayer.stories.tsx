import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'
import { fn } from 'storybook/test'
import type { QueueEntry } from '@/player/player-context'
import { MiniPlayer } from './MiniPlayer'

const entry: QueueEntry = {
  match: 0,
  reason: '',
  item: {
    id: 'i1',
    domainId: 'youtube',
    source: 'youtube',
    externalId: 'abc',
    title: 'Noche de neón con un título largo que no cabe',
    subtitle: 'Nadia Vela',
    description: null,
    imageUrl: 'https://picsum.photos/seed/mini/96',
    mediaUrl: null,
    externalUrl: null,
    durationSec: 214,
    attributes: {},
    tags: [],
    popularity: 0,
  },
}

const meta = {
  title: 'Organisms/MiniPlayer',
  component: MiniPlayer,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  args: { entry, playing: true, onToggle: fn(), onShuffle: fn(), onRepeat: fn(), onClose: fn() },
} satisfies Meta<typeof MiniPlayer>

export default meta
type Story = StoryObj<typeof meta>

/** La ✕ para la música y cierra; en pantallas de menos de 400 px se ocultan aleatorio y repetir. */
export const Sonando: Story = {}
export const EnPausa: Story = { args: { playing: false } }
