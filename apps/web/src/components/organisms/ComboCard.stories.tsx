import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ComboCard } from './ComboCard'

const open = fn()
const meta = {
  title: 'Organisms/ComboCard',
  component: ComboCard,
  args: {
    title: 'El combo de esta noche',
    subtitle: 'Según la hora, el tiempo y tus gustos',
    slots: [
      {
        domainId: 'movies',
        icon: 'movies',
        name: 'Película',
        role: 'para ahora',
        why: 'Noche de sábado con lluvia: algo pausado',
        entries: [{ id: 'm1', title: 'Her', subtitle: 'Spike Jonze', imageUrl: null, reason: 'Dir. Spike Jonze (2013) · pausada y luminosa', onOpen: open }],
      },
      {
        domainId: 'music',
        icon: 'music',
        name: 'Música',
        role: 'para después',
        why: 'Noche de sábado con lluvia: algo pausado',
        entries: [
          { id: 'a1', title: 'Midnight Rain', subtitle: 'Luna Park', imageUrl: null, reason: 'De Luna Park · tranquila y acústica', onOpen: open },
          { id: 'a2', title: 'After Hours', subtitle: 'Nite Owl', imageUrl: null, reason: 'De Nite Owl · tranquila y melancólica', onOpen: open },
        ],
      },
      {
        domainId: 'games',
        icon: 'games',
        name: 'Videojuego',
        role: 'para mañana',
        why: 'Noche de sábado con lluvia: algo pausado',
        entries: [{ id: 'g1', title: 'Hollow Knight', subtitle: 'Team Cherry', imageUrl: null, reason: 'De Team Cherry (2017) · tranquilo y desafiante', onOpen: open }],
      },
    ],
  },
  decorators: [(Story) => <div className="w-[350px] md:w-[520px]"><Story /></div>],
} satisfies Meta<typeof ComboCard>
export default meta
type Story = StoryObj<typeof meta>

export const Saturday: Story = {}
export const Loading: Story = { args: { loading: true, slots: [] } }
