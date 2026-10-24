import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { FolderPanel } from './FolderPanel'

const base = { access: 'ready', folderName: 'Reguetón', found: 412, phase: 'idle', step: '', done: 0, total: 0 } as const

const meta = {
  title: 'Organisms/FolderPanel',
  component: FolderPanel,
  decorators: [(Story) => <div data-domain="folder" className="max-w-md"><Story /></div>],
  args: { state: base, canRemember: true, itemCount: 380, review: 4, onChoose: fn(), onReconnect: fn(), onImport: fn(), onReview: fn(), onForget: fn() },
} satisfies Meta<typeof FolderPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {}
export const Empty: Story = { args: { state: { ...base, access: 'none', folderName: null, found: 0 }, itemCount: 0, review: 0 } }
export const Working: Story = { args: { state: { ...base, phase: 'importing', step: 'Identificando tus canciones (96/412)', done: 96, total: 412 } } }
export const Pending: Story = { args: { pending: 41 } }
export const Failed: Story = { args: { state: { ...base, phase: 'error', error: 'Sin conexión con el servidor' } } }
