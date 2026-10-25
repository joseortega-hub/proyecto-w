import type { Meta, StoryObj } from '@storybook/react-vite'
import { Heading, Text } from './Typography'

const meta = { title: 'Atoms/Typography', component: Heading } satisfies Meta<typeof Heading>
export default meta
type Story = StoryObj<typeof meta>

export const Scale: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-4">
      <Heading size="display">Cuéntanos cómo te sientes y te recomendamos lo que mejor encaja.</Heading>
      <Heading size="question">¿Te apetece moverte?</Heading>
      <Heading size="title">Tarde de concentración</Heading>
      <Heading as="h2" size="section">Tu perfil de ánimo</Heading>
      <Text size="lead" tone="muted">Unas pocas preguntas de sí o no. Sin formularios ni registro.</Text>
      <Text font="label">Pregunta 3 · máx. 10</Text>
      <Text font="mono" size="sm">0,85 · 3:48</Text>
    </div>
  ),
}
