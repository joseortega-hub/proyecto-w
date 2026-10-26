import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { Item } from '@/lib/api'
import { YourYouTubeSongs } from './YourYouTubeSongs'

const song = (id: string, title: string): Item => ({
  id,
  domainId: 'youtube',
  source: 'youtube',
  externalId: id,
  title,
  subtitle: 'Bad Bunny',
  description: null,
  imageUrl: `https://picsum.photos/seed/${id}/96`,
  mediaUrl: null,
  externalUrl: null,
  durationSec: 205,
  attributes: {},
  tags: [],
  popularity: 0,
})

const meta = {
  title: 'Organisms/YourYouTubeSongs',
  component: YourYouTubeSongs,
  args: { artistName: 'Bad Bunny', songs: [song('a', 'DtMF'), song('b', 'Baile Inolvidable'), song('c', 'Tití Me Preguntó')], onPlay: fn(), activeItemId: 'b', playing: true },
} satisfies Meta<typeof YourYouTubeSongs>

export default meta
type Story = StoryObj<typeof meta>

export const VariosTemas: Story = {}
export const UnTema: Story = { args: { songs: [song('a', 'DtMF')], activeItemId: null } }
