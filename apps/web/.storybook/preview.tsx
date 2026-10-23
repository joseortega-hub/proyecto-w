import { withThemeByClassName } from '@storybook/addon-themes'
import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: { matchers: { color: /(background|color)$/i } },
    a11y: { test: 'todo' },
  },
  decorators: [
    withThemeByClassName({ themes: { claro: '', oscuro: 'dark' }, defaultTheme: 'claro' }),
    (Story) => (
      <div className="bg-background p-6 text-foreground">
        <Story />
      </div>
    ),
  ],
}
export default preview
