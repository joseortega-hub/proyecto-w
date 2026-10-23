import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { TasteEditor, type TasteDraft } from './TasteEditor'

const groups = [
  { id: '@action', label: 'acción y disparos' },
  { id: '@rpg', label: 'rol y aventura' },
  { id: '@cozy', label: 'casuales y relajados' },
  { id: '@strategy', label: 'estrategia' },
  { id: '@horror', label: 'terror y supervivencia' },
]
const tags = ['open world', 'co op', 'story rich', 'sci fi', 'exploration', 'difficult', 'funny', 'sandbox', 'puzzle', 'survival'].map((label) => ({
  id: label.replace(/ /g, '-'),
  label,
}))

const meta = {
  title: 'Organisms/TasteEditor',
  component: TasteEditor,
  args: { value: { likes: [], dislikes: [] }, onChange: () => {}, groups, tags, nounPlural: 'videojuegos', initialTags: 6 },
  decorators: [(Story) => <div data-domain="games" className="max-w-xl">{Story()}</div>],
} satisfies Meta<typeof TasteEditor>
export default meta
type Story = StoryObj<typeof meta>

/** Con texto libre: la IA (aquí, simulada) marca los chips. */
export const ConTextoLibre: Story = {
  render: (args) => {
    const [value, setValue] = useState<TasteDraft>({ likes: ['@rpg'], dislikes: [] })
    return (
      <TasteEditor
        {...args}
        value={value}
        onChange={setValue}
        onInterpret={async () => ({ likes: [{ id: 'open-world', label: 'open world' }, { id: 'pokemon-like', label: 'criaturas' }], dislikes: [{ id: '@horror', label: 'terror y supervivencia' }] })}
      />
    )
  },
}

export const SoloChips: Story = { args: { value: { likes: ['@cozy', 'puzzle'], dislikes: ['difficult'] } } }
