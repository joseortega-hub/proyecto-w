import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'
import { SettingsMenu } from './SettingsMenu'

const meta = {
  title: 'Organisms/SettingsMenu',
  component: SettingsMenu,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/music']}>
        <div className="flex min-h-[460px] justify-end p-4">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof SettingsMenu>
export default meta
type Story = StoryObj<typeof meta>

/** Un solo botón «⋯» con modo oscuro, estilo, «Personalizar», «Tu historia», «Bajo el capó» y el buzón. */
export const Abierto: Story = {
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('button[aria-label="Ajustes y más"]')?.click()
  },
}
/** Con enlaces de la estructura «Una mano», que no caben en su barra. */
export const ConEnlacesExtra: Story = {
  args: { extraLinks: [{ to: '/music/gustos', label: 'Mis gustos', icon: 'heart' }] },
  play: Abierto.play,
}
