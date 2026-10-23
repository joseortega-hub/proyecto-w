import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { PreferencePicker } from './PreferencePicker'

const language = {
  key: 'language',
  label: 'Idioma de la letra',
  anyValue: 'any',
  options: [
    { value: 'es', label: 'Español' },
    { value: 'en', label: 'Inglés' },
    { value: 'any', label: 'Me da igual' },
  ],
}

const meta = {
  title: 'Molecules/PreferencePicker',
  component: PreferencePicker,
  args: { preference: language, value: 'any', onChange: () => {} },
} satisfies Meta<typeof PreferencePicker>

export default meta
type Story = StoryObj<typeof meta>

export const MeDaIgual: Story = {}

export const Espanol: Story = {
  render: (args) => {
    const [value, setValue] = useState('es')
    return <PreferencePicker {...args} value={value} onChange={setValue} />
  },
}

/** Muchas opciones (plataformas de videojuegos): saltan de línea. */
export const ManyOptions: Story = {
  args: {
    preference: {
      key: 'platforms',
      label: 'Dónde juegas',
      anyValue: 'any',
      options: [
        { value: 'pc', label: 'PC' },
        { value: 'playstation', label: 'PlayStation' },
        { value: 'xbox', label: 'Xbox' },
        { value: 'nintendo', label: 'Nintendo' },
        { value: 'mobile', label: 'Móvil' },
        { value: 'any', label: 'Me da igual' },
      ],
    },
  },
}
