import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatTile } from './StatTile'

const meta = { title: 'Molecules/StatTile', component: StatTile, args: { label: 'Mediana', value: '420 ms' } } satisfies Meta<typeof StatTile>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithHint: Story = { args: { label: 'Coste', value: '0 €', hint: 'gratis · equivaldría a 0,4 cént.' } }
