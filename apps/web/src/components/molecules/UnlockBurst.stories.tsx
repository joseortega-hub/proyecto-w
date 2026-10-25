import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { UnlockBurst } from './UnlockBurst'

const meta = { title: 'Molecules/UnlockBurst', component: UnlockBurst, args: { onDone: fn(), duration: 600000 }, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof UnlockBurst>
export default meta
type Story = StoryObj<typeof meta>

/** Pantalla completa; en la app se cierra sola a los 3,4 s (o al tocarla). Sin artista, magenta neón. */
export const Default: Story = {}
/** Cada artista que abre el modo trae su color (de su foto o elegido a mano). */
export const DembowRojo: Story = { args: { color: '#ff4f5e', name: 'El Alfa' } }
export const TrapVioleta: Story = { args: { color: '#9357c9', name: 'Mami' } }
export const LimaEscenario: Story = { args: { color: '#9cff4a', name: 'Dale Mami' } }
