import type { Meta, StoryObj } from '@storybook/react-vite'
import { LearnMore } from './LearnMore'

const meta = {
  title: 'Molecules/LearnMore',
  component: LearnMore,
  decorators: [(Story) => <div className="w-[340px]"><Story /></div>],
} satisfies Meta<typeof LearnMore>
export default meta
type Story = StoryObj<typeof meta>

/** "Algo de Nintendo" en videojuegos: datos reales de Wikidata (Q8093). */
export const Studio: Story = {
  args: {
    links: {
      query: 'Nintendo',
      entity: { id: 'Q8093', label: 'Nintendo', description: 'empresa japonesa creadora de videojuegos y de videoconsolas' },
      links: [
        { site: 'official', url: 'https://www.nintendo.com/jp/index.html' },
        { site: 'wikipedia', url: 'https://es.wikipedia.org/wiki/Nintendo' },
        { site: 'rawg', url: 'https://rawg.io/developers/nintendo' },
        { site: 'reddit', url: 'https://www.reddit.com/r/nintendo/' },
        { site: 'instagram', url: 'https://www.instagram.com/nintendo/' },
        { site: 'youtube', url: 'https://www.youtube.com/channel/UCkH3CcMfqww9RsZvPRPkAJA' },
      ],
    },
  },
}

/** Una saga de cine con wiki de fans en español. */
export const Franchise: Story = {
  args: {
    links: {
      query: 'Marvel',
      entity: { id: 'Q642878', label: 'Universo cinematográfico de Marvel', description: null },
      links: [
        { site: 'official', url: 'https://www.marvel.com/movies' },
        { site: 'wikipedia', url: 'https://es.wikipedia.org/wiki/Universo_cinematogr%C3%A1fico_de_Marvel' },
        { site: 'fandom', url: 'https://marvel.fandom.com/es/wiki/Tierra-199999' },
      ],
    },
  },
}

/** Un artista: Wikipedia, MusicBrainz y sus redes. */
export const Artist: Story = {
  args: {
    links: {
      query: 'Bad Bunny',
      entity: { id: 'Q44333953', label: 'Bad Bunny', description: null },
      links: [
        { site: 'wikipedia', url: 'https://es.wikipedia.org/wiki/Bad_Bunny' },
        { site: 'musicbrainz', url: 'https://musicbrainz.org/artist/89aa5ecb-59ad-46f5-b3eb-2d424e941f19' },
        { site: 'instagram', url: 'https://www.instagram.com/badbunnypr/' },
        { site: 'x', url: 'https://x.com/sanbenito' },
      ],
    },
  },
}

/** Sin enlaces verificados el bloque no aparece. */
export const Empty: Story = { args: { links: { query: 'Algo raro', entity: null, links: [] } } }
