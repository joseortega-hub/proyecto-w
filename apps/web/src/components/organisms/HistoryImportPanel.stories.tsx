import type { Meta, StoryObj } from '@storybook/react-vite'
import type { HistoryImport } from '@/lib/api'
import { HistoryImportPanel } from './HistoryImportPanel'

const view = (over: Partial<HistoryImport> = {}): HistoryImport => ({
  id: '1',
  domainId: 'movies',
  source: 'letterboxd',
  status: 'done',
  total: 312,
  processed: 312,
  found: 280,
  added: 270,
  notFound: 32,
  missing: ['Una película rara (1987)', 'Cortometraje de clase (2019)'],
  ...over,
})

const meta = {
  title: 'Organisms/HistoryImportPanel',
  component: HistoryImportPanel,
  args: { source: 'letterboxd', nounPlural: 'películas', foundWord: 'encontradas', view: null, running: false, onCsv: () => {}, onSteam: () => {}, onResume: () => {} },
  decorators: [(Story) => <div data-domain="movies" className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof HistoryImportPanel>
export default meta
type Story = StoryObj<typeof meta>

export const SinEmpezar: Story = {}
export const Importando: Story = { args: { running: true, view: view({ status: 'running', processed: 125, found: 110, notFound: 15 }) } }
export const AMedias: Story = { args: { view: view({ status: 'running', processed: 125, found: 110, notFound: 15 }) } }
export const Terminada: Story = { args: { view: view() } }
export const Steam: Story = {
  args: { source: 'steam', nounPlural: 'videojuegos', foundWord: 'encontrados', error: 'No vemos tus juegos: en Steam, pon públicos tu perfil y los «Detalles de los juegos»' },
  decorators: [(Story) => <div data-domain="games">{Story()}</div>],
}
