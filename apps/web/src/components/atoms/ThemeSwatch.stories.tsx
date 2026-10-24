import type { Meta, StoryObj } from '@storybook/react-vite'
import { THEMES } from '@/lib/theme'
import { ThemeSwatch } from './ThemeSwatch'

const meta = {
  title: 'Atoms/ThemeSwatch',
  component: ThemeSwatch,
  args: { colors: THEMES[0].modes.light.swatches },
} satisfies Meta<typeof ThemeSwatch>
export default meta
type Story = StoryObj<typeof meta>

export const Sintonia: Story = {}
/** Todos los temas, en claro y en oscuro. */
export const TodosLosTemas: Story = {
  render: () => (
    <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-4 gap-y-2 text-sm">
      {THEMES.map((t) => (
        <div key={t.id} className="contents">
          <span className="font-bold">{t.label}</span>
          <ThemeSwatch colors={t.modes.light.swatches} />
          <ThemeSwatch colors={t.modes.dark.swatches} />
        </div>
      ))}
    </div>
  ),
}
