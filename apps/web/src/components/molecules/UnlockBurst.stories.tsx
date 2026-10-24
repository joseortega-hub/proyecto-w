import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { UnlockBurst } from './UnlockBurst'

const meta = { title: 'Molecules/UnlockBurst', component: UnlockBurst, args: { onDone: fn(), duration: 600000 }, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof UnlockBurst>
export default meta
type Story = StoryObj<typeof meta>

/** Pantalla completa; en la app se cierra sola a los 2 s (o al tocarla). */
export const Default: Story = {}
