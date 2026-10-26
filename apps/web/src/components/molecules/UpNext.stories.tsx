import type { Meta, StoryObj } from '@storybook/react-vite'
import { UpNext } from './UpNext'

const entries = [
  { index: 3, title: 'Luz de madrugada', subtitle: 'Nadia Vela', imageUrl: 'https://picsum.photos/seed/up1/96' },
  { index: 4, title: 'Ruta 66 en bici', subtitle: 'Los Faroles', imageUrl: 'https://picsum.photos/seed/up2/96' },
  { index: 5, title: 'Una canción con un título largo que no cabe en una línea', subtitle: 'Varios artistas', imageUrl: null },
]

const meta = {
  title: 'Molecules/UpNext',
  component: UpNext,
  args: { entries, onSelect: () => undefined },
  decorators: [(Story) => <div className="w-[340px]"><Story /></div>],
} satisfies Meta<typeof UpNext>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Shuffle: Story = { args: { shuffle: true } }
export const Fichas: Story = { args: { actionLabel: 'Ver la ficha de', entries: entries.map((e) => ({ ...e, subtitle: '2019 · Aventura' })) } }
export const ConAnterior: Story = { args: { previous: { index: 2, title: 'Noche en la azotea', subtitle: 'Marta Sol', imageUrl: 'https://picsum.photos/seed/up0/96' } } }
export const SoloAnterior: Story = { args: { entries: [], previous: { index: 2, title: 'Noche en la azotea', subtitle: 'Marta Sol', imageUrl: null } } }
