import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TodayHero } from './TodayHero'

const meta = {
  title: 'Organisms/TodayHero',
  component: TodayHero,
  args: {
    value: '',
    onChange: fn(),
    onSubmit: fn(),
    onPick: fn(),
    speech: true,
    context: { franja: 'noche', diaSemana: 'sábado', finDeSemana: true, tiempo: { descripcion: 'lluvia', temperaturaC: 14, esDeDia: false } },
  },
  decorators: [(Story) => <div className="w-[350px] md:w-[560px]"><Story /></div>],
} satisfies Meta<typeof TodayHero>
export default meta
type Story = StoryObj<typeof meta>

export const RainyNight: Story = {}
export const SunnyMorning: Story = {
  args: { context: { franja: 'mañana', diaSemana: 'lunes', tiempo: { descripcion: 'despejado', temperaturaC: 22, esDeDia: true } } },
}
export const NoWeather: Story = { args: { context: { franja: 'tarde', diaSemana: 'miércoles' } } }
export const Detecting: Story = { args: { value: 'algo de Marvel', busy: true } }
export const WithChoices: Story = {
  args: {
    value: 'algo para desconectar',
    choices: [
      { id: 'movies', name: 'Películas', icon: 'movies' },
      { id: 'books', name: 'Libros', icon: 'books' },
      { id: 'games', name: 'Videojuegos', icon: 'games' },
    ],
  },
}
