import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { AddTracksPanel } from './AddTracksPanel'

const meta = { title: 'Organisms/AddTracksPanel', component: AddTracksPanel, args: { domainId: 'music', noun: 'canciones', existingIds: new Set<string>(), onAdd: fn() } } satisfies Meta<typeof AddTracksPanel>
export default meta
type Story = StoryObj<typeof meta>

/** Sin escribir nada: solo la pista. La búsqueda real necesita la API. */
export const Empty: Story = {}
