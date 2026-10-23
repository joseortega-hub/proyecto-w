import type { Meta, StoryObj } from '@storybook/react-vite'
import { DomainIcon } from './DomainIcon'

const meta = {
  title: 'Atoms/DomainIcon',
  component: DomainIcon,
  args: { icon: 'games', domain: 'games' },
} satisfies Meta<typeof DomainIcon>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const AllDomains: Story = {
  render: () => (
    <div className="flex gap-3">
      <DomainIcon icon="music" domain="music" />
      <DomainIcon icon="games" domain="games" />
      <DomainIcon icon="movies" domain="movies" />
      <DomainIcon icon="books" domain="books" />
    </div>
  ),
}
export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-3">
      <DomainIcon icon="movies" domain="movies" size="sm" />
      <DomainIcon icon="movies" domain="movies" size="md" />
      <DomainIcon icon="movies" domain="movies" size="lg" />
    </div>
  ),
}
