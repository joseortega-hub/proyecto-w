import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { FeedbackKind } from '@/lib/feedback'
import { FeedbackForm } from './FeedbackForm'

// Un píxel PNG de muestra para ver las miniaturas.
const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const meta = {
  title: 'Molecules/FeedbackForm',
  component: FeedbackForm,
  args: {
    kind: 'error',
    onKind: () => undefined,
    message: '',
    onMessage: () => undefined,
    images: [],
    onAddFiles: () => undefined,
    onRemoveImage: () => undefined,
    contextLabel: '/games/biblioteca/42 · Videojuegos',
  },
  decorators: [(Story) => <div className="w-[360px]"><Story /></div>],
} satisfies Meta<typeof FeedbackForm>
export default meta
type Story = StoryObj<typeof meta>

function Interactive() {
  const [kind, setKind] = useState<FeedbackKind>('idea')
  const [message, setMessage] = useState('Poder ordenar la biblioteca por año.')
  return <FeedbackForm kind={kind} onKind={setKind} message={message} onMessage={setMessage} images={[{ type: 'image/png', data: pixel }]} onAddFiles={() => undefined} onRemoveImage={() => undefined} contextLabel="/music/biblioteca · Música" />
}

export const Default: Story = { render: () => <Interactive /> }
export const Compressing: Story = { args: { compressing: true, message: 'La ficha se rompe al bajar.' } }
export const WithError: Story = { args: { error: 'Cuéntanos un poco más.' } }
