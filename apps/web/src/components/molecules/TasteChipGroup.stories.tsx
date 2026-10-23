import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { TasteChipGroup } from './TasteChipGroup'

const groups = [
  { id: '@action', label: 'acción y disparos' },
  { id: '@rpg', label: 'rol y aventura' },
  { id: '@cozy', label: 'casuales y relajados' },
  { id: '@strategy', label: 'estrategia' },
  { id: '@sports', label: 'deportes y carreras' },
  { id: '@horror', label: 'terror y supervivencia' },
  { id: '@retro', label: 'plataformas y arcade' },
]

const meta = {
  title: 'Molecules/TasteChipGroup',
  component: TasteChipGroup,
  args: { label: 'Géneros', options: groups, likes: ['@rpg'], dislikes: ['@horror'], onToggle: () => {} },
  decorators: [(Story) => <div data-domain="games" className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof TasteChipGroup>
export default meta
type Story = StoryObj<typeof meta>

export const Marcados: Story = {}

export const Interactivo: Story = {
  render: (args) => {
    const [likes, setLikes] = useState<string[]>([])
    const [dislikes, setDislikes] = useState<string[]>([])
    const toggle = (id: string) => {
      if (likes.includes(id)) {
        setLikes(likes.filter((l) => l !== id))
        setDislikes([...dislikes, id])
      } else if (dislikes.includes(id)) setDislikes(dislikes.filter((d) => d !== id))
      else setLikes([...likes, id])
    }
    return <TasteChipGroup {...args} likes={likes} dislikes={dislikes} onToggle={toggle} />
  },
}
