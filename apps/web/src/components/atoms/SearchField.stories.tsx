import type { Meta, StoryObj } from '@storybook/react-vite'
import { SearchField } from './SearchField'

const meta = {
  title: 'Atoms/SearchField',
  component: SearchField,
  args: { label: 'Buscar videojuegos por título o estudio' },
  decorators: [(Story) => <div className="w-[350px]"><Story /></div>],
} satisfies Meta<typeof SearchField>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}
export const WithValue: Story = { args: { defaultValue: 'zelda' } }
