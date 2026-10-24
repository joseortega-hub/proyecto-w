import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TributeCover } from './TributeCover'

const meta = {
  title: 'Organisms/TributeCover',
  component: TributeCover,
  args: {
    artistName: 'Wisin',
    nickname: 'El Matatán',
    photoUrl: null,
    bio: 'Juan Luis Morera Luna, conocido como Wisin, es un cantante puertorriqueño de reguetón. Es una de las voces clave del género desde finales de los noventa. Más cosas que no se ven.',
    songCount: 14,
    onPlay: fn(),
    onMakeList: fn(),
    onExplore: fn(),
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TributeCover>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithoutSongs: Story = { args: { songCount: 0 } }
export const WithoutNickname: Story = { args: { nickname: undefined } }
