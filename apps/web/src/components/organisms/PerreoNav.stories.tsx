import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'
import { PerreoBottomNav, PerreoSideNav, PerreoTopBar } from './PerreoNav'

const meta = {
  title: 'Organisms/PerreoNav',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/perreo/caliente']}>
        <div data-perreo-ui="" data-domain="perreo" style={{ ['--artist' as string]: '#9cff4a' }} className="min-h-[420px] text-white">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

/** Móvil: cartel arriba y cápsula abajo (la sección activa salta en pegatina). */
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => (
    <div className="flex h-[420px] flex-col justify-between">
      <PerreoTopBar nickname="Dale Mami" />
      <PerreoBottomNav className="!block" />
    </div>
  ),
}

/** Escritorio: riel lateral con el cartel del modo. */
export const Desktop: Story = {
  render: () => (
    <div className="flex h-[560px]">
      <PerreoSideNav nickname="Dale Mami" className="!flex" />
    </div>
  ),
}
