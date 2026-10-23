import type { Meta, StoryObj } from '@storybook/react-vite'
import { MatchBadge } from './MatchBadge'

const meta = { title: 'Atoms/MatchBadge', component: MatchBadge, args: { value: 94 } } satisfies Meta<typeof MatchBadge>
export default meta
type Story = StoryObj<typeof meta>

export const High: Story = {}
export const Low: Story = { args: { value: 61 } }
