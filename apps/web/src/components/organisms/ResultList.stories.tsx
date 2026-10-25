import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { ResultEntry } from '@/lib/api'
import { ResultList } from './ResultList'

const entry = (n: number, title: string): ResultEntry => ({
  match: 90 - n * 4,
  fit: 0.9,
  reason: n === 0 ? 'Va con tu ánimo de hoy.' : '',
  item: { id: `i${n}`, domainId: 'music', source: 'jamendo', externalId: `${n}`, title, subtitle: 'Artista', description: null, imageUrl: null, mediaUrl: null, externalUrl: null, durationSec: 200 + n * 7, attributes: {}, tags: [], popularity: 0 },
})
const entries = [entry(0, 'Noche de neón'), entry(1, 'Calle vacía'), entry(2, 'Dembow lento'), entry(3, 'Última canción')]

const meta = { title: 'Organisms/ResultList', component: ResultList, args: { entries, onSelect: fn() } } satisfies Meta<typeof ResultList>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
/** Con asa ⠿ para arrastrar (pulsación larga al tacto, ↑ ↓ con teclado) y botón para quitar. */
export const Editing: Story = { args: { edit: { onMove: fn(), onRemove: fn() } } }
