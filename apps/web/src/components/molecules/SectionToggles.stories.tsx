import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { SECTION_GROUPS, toggleHidden } from '@/lib/sections'
import { SectionToggles } from './SectionToggles'

const meta = {
  title: 'Molecules/SectionToggles',
  component: SectionToggles,
  args: { groups: SECTION_GROUPS, hidden: [], onChange: () => undefined, onShowAll: () => undefined },
  decorators: [(Story) => <div className="w-[320px]"><Story /></div>],
} satisfies Meta<typeof SectionToggles>
export default meta
type Story = StoryObj<typeof meta>

function Interactive() {
  const [hidden, setHidden] = useState<string[]>(['item.tags', 'result.stats'])
  return <SectionToggles groups={SECTION_GROUPS} hidden={hidden} onChange={(id, hide) => setHidden((h) => toggleHidden(h, id, hide))} onShowAll={() => setHidden([])} />
}

export const Default: Story = { render: () => <Interactive /> }
export const NothingHidden: Story = {}
