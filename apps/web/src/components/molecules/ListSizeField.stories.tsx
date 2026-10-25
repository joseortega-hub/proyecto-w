import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ListSizeField } from './ListSizeField'

const meta = { title: 'Molecules/ListSizeField', component: ListSizeField, args: { value: { min: 10, max: 20 }, noun: 'canciones', onChange: fn() } } satisfies Meta<typeof ListSizeField>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Wide: Story = { args: { value: { min: 5, max: 50 } } }
export const Exact: Story = { args: { value: { min: 12, max: 12 }, noun: 'películas' } }
