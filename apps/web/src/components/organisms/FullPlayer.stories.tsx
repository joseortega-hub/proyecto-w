import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { QueueEntry } from '@/player/player-context'
import { seenWords } from '@/lib/seen'
import { FullPlayer } from './FullPlayer'

const entry = (source: string): QueueEntry => ({
  match: 86,
  reason: 'Va con tu ánimo de hoy y con tus gustos: reguetón lento.',
  item: {
    id: 'i1',
    domainId: source === 'youtube' ? 'youtube' : 'music',
    source,
    externalId: 'abc',
    title: 'Noche de neón',
    subtitle: 'Nadia Vela',
    description: null,
    imageUrl: 'https://picsum.photos/seed/full/600',
    mediaUrl: null,
    externalUrl: source === 'youtube' ? 'https://music.youtube.com/watch?v=abc' : 'https://www.jamendo.com',
    durationSec: 214,
    attributes: {},
    tags: [],
    popularity: 0,
  },
})

const upNext = [
  { index: 2, title: 'Calle vacía', subtitle: 'Los Faroles', imageUrl: 'https://picsum.photos/seed/n1/96' },
  { index: 3, title: 'Dembow lento', subtitle: 'Marta Sol', imageUrl: null },
]

const meta = {
  title: 'Organisms/FullPlayer',
  component: FullPlayer,
  args: {
    entry: entry('jamendo'),
    listTitle: 'Viernes con ganas de bailar',
    playing: true,
    position: 62,
    duration: 214,
    hasPrevious: true,
    hasNext: true,
    onClose: fn(),
    onToggle: fn(),
    onPrevious: fn(),
    onNext: fn(),
    onSeek: fn(),
    onJump: fn(),
    upNext,
    previousEntry: { index: 0, title: 'Luz de madrugada', subtitle: 'Nadia Vela', imageUrl: 'https://picsum.photos/seed/p0/96' },
    feedback: { value: null, onChange: fn() },
  },
  decorators: [(Story) => <div className="flex w-[380px] flex-col p-6"><Story /></div>],
} satisfies Meta<typeof FullPlayer>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ConYaEscuchada: Story = { args: { feedback: { value: 'up', onChange: fn() }, seen: { words: seenWords('music'), rating: 'loved', onChange: fn() } } }
export const YouTube: Story = { args: { entry: entry('youtube') } }
export const AlPrincipio: Story = { args: { hasPrevious: false, previousEntry: null } }
