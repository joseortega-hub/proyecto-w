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
    // Vistas de la auditoría responsive: móvil estrecho, móvil, tableta, escritorio y móvil en horizontal.
    viewport: {
      options: {
        movil320: { name: 'Móvil 320', styles: { width: '320px', height: '640px' }, type: 'mobile' },
        movil360: { name: 'Móvil 360', styles: { width: '360px', height: '740px' }, type: 'mobile' },
        movil414: { name: 'Móvil 414', styles: { width: '414px', height: '896px' }, type: 'mobile' },
        horizontal: { name: 'Móvil horizontal', styles: { width: '667px', height: '375px' }, type: 'mobile' },
        tableta: { name: 'Tableta 768', styles: { width: '768px', height: '1024px' }, type: 'tablet' },
        escritorio: { name: 'Escritorio 1280', styles: { width: '1280px', height: '800px' }, type: 'desktop' },
      },
    },
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
