import type { Decorator, Preview } from '@storybook/react-vite'
import { type ReactNode, useEffect } from 'react'
import { applyTheme, DEFAULT_PALETTE, THEMES } from '../src/lib/theme'
import '../src/index.css'

/** Aplica en <html> el tema y el modo de la barra de Storybook, igual que la app (data-theme y .dark). */
function ThemeFrame({ palette, mode, children }: { palette: string; mode: 'light' | 'dark'; children: ReactNode }) {
  useEffect(() => applyTheme(mode, palette), [mode, palette])
  return <div className="bg-background p-6 text-foreground">{children}</div>
}
const withAppTheme: Decorator = (Story, context) => (
  <ThemeFrame palette={context.globals.palette ?? DEFAULT_PALETTE} mode={context.globals.mode ?? 'light'}>
    <Story />
  </ThemeFrame>
)

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: { matchers: { color: /(background|color)$/i } },
    a11y: { test: 'todo' },
  },
  globalTypes: {
    palette: {
      description: 'Tema (selector 🎨 de la app)',
      toolbar: { title: 'Tema', icon: 'paintbrush', items: THEMES.map((t) => ({ value: t.id, title: t.label })), dynamicTitle: true },
    },
    mode: {
      description: 'Modo claro u oscuro',
      toolbar: {
        title: 'Modo',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Claro', icon: 'sun' },
          { value: 'dark', title: 'Oscuro', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { palette: DEFAULT_PALETTE, mode: 'light' },
  decorators: [withAppTheme],
}
export default preview
