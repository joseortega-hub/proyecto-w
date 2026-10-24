import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { IntentChips } from './IntentChips'

const meta = {
  title: 'Molecules/IntentChips',
  component: IntentChips,
  args: {
    onPick: fn(),
    choices: [
      { id: 'movies', name: 'Películas', icon: 'movies' },
      { id: 'books', name: 'Libros', icon: 'books' },
      { id: 'games', name: 'Videojuegos', icon: 'games' },
    ],
  },
  decorators: [(Story) => <div className="w-[350px]"><Story /></div>],
} satisfies Meta<typeof IntentChips>
export default meta
type Story = StoryObj<typeof meta>

export const Three: Story = {}
export const Two: Story = { args: { choices: [{ id: 'music', name: 'Música', icon: 'music' }, { id: 'youtube', name: 'Mi YouTube', icon: 'youtube' }] } }
export const AfterError: Story = { args: { message: 'No he podido entenderte ahora mismo. Elige una temática.' } }
