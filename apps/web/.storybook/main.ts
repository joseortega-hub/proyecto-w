import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-themes', '@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
  // El plugin PWA no pinta nada en Storybook.
  viteFinal: async (config) => ({
    ...config,
    plugins: (config.plugins ?? []).flat().filter((p) => !(p && typeof p === 'object' && 'name' in p && String(p.name).startsWith('vite-plugin-pwa'))),
  }),
}
export default config
