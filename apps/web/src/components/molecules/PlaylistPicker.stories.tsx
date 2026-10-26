import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { PlaylistPicker } from './PlaylistPicker'

const playlists = [
  { id: 'p1', title: 'Demasiado música 20', itemCount: 34, publishedAt: '2026-10-20T10:00:00Z', thumbnail: 'https://picsum.photos/seed/pl1/96', importedAt: null, songs: null },
  { id: 'p2', title: 'Perreo del finde', itemCount: 58, publishedAt: '2026-06-02T10:00:00Z', thumbnail: 'https://picsum.photos/seed/pl2/96', importedAt: '2026-10-24T18:00:00Z', songs: 51 },
  { id: 'p3', title: 'Lista vacía', itemCount: 0, publishedAt: '2021-01-01T10:00:00Z', thumbnail: null, importedAt: null, songs: null },
]

const meta = {
  title: 'Molecules/PlaylistPicker',
  component: PlaylistPicker,
  args: { playlists, onImport: fn(), onCancel: fn() },
  decorators: [(Story) => <div className="w-[360px]"><Story /></div>],
} satisfies Meta<typeof PlaylistPicker>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Cargando: Story = { args: { playlists: undefined } }
export const SinListas: Story = { args: { playlists: [] } }
