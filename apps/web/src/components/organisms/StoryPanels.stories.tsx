import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'
import { AiPanel, LearnedPanel, TopPanel } from './StoryPanels'

const meta = {
  title: 'Organisms/StoryPanels',
  decorators: [(Story) => <MemoryRouter><div className="w-[350px] md:w-[640px]"><Story /></div></MemoryRouter>],
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Top: Story = {
  render: () => (
    <TopPanel
      tasteFit={72}
      top={[
        { domainId: 'games', name: 'Videojuegos', icon: 'games', total: 18, liked: 13, creators: [{ label: 'Nintendo', count: 5 }, { label: 'Team Cherry', count: 2 }], genres: [{ label: 'rol y aventura', count: 9 }, { label: 'casuales y relajados', count: 5 }] },
        { domainId: 'music', name: 'Música', icon: 'music', total: 20, liked: 14, creators: [], genres: [{ label: 'urbano y latino', count: 11 }] },
      ]}
    />
  ),
}
export const TopEmpty: Story = { render: () => <TopPanel tasteFit={null} top={[]} /> }

export const Learned: Story = {
  render: () => (
    <LearnedPanel
      learned={[
        { domainId: 'games', name: 'Videojuegos', icon: 'games', likes: ['rol y aventura'], dislikes: ['terror y supervivencia'], up: [{ label: 'metroidvania', weight: 0.45 }, { label: 'pixel graphics', weight: 0.3 }], down: [{ label: 'shooter', weight: -0.3 }], thumbsUp: 6, thumbsDown: 2 },
      ]}
    />
  ),
}
export const LearnedEmpty: Story = { render: () => <LearnedPanel learned={[]} /> }

export const Ai: Story = {
  render: () => <AiPanel ai={{ lists: 12, questionsSaved: 21, calls: 48, providers: [{ label: 'groq', count: 40 }, { label: 'gemini', count: 8 }], listCostEur: 0.0312, paidEur: 0, tracesWindowHours: 48 }} />,
}
