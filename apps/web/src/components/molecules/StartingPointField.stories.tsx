import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { StartingPointField } from './StartingPointField'

const meta = {
  title: 'Molecules/StartingPointField',
  component: StartingPointField,
  args: {
    value: '',
    onChange: () => {},
    label: '¿Cómo estás o qué te apetece jugar?',
    placeholder: 'Ej.: vengo reventado del curro, algo tranqui para un rato',
  },
  decorators: [(Story) => <div data-domain="games" className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof StartingPointField>
export default meta
type Story = StoryObj<typeof meta>

export const ConMicrofono: Story = {
  args: { speech: true },
  render: (args) => {
    const [value, setValue] = useState('')
    return <StartingPointField {...args} value={value} onChange={setValue} />
  },
}

/** Firefox y otros navegadores sin Web Speech API: sin 🎤. */
export const SinMicrofono: Story = { args: { speech: false, value: 'Me apetece algo para jugar con amigos' } }
