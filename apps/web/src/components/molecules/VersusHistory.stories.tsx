import type { Meta, StoryObj } from '@storybook/react-vite'
import type { PulseArtist } from '@/lib/perreo-pulse'
import { VersusHistory } from './VersusHistory'

const a = (name: string, color: string): PulseArtist => ({ slug: name.toLowerCase().replace(/\s+/g, '-'), name, nickname: null, photoV: null, color, countries: [], fame: 90 })
const feid = a('Feid', '#7ed957')
const miko = a('Young Miko', '#9357c9')
const days = ['2026-10-20', '2026-10-22', '2026-10-24', '2026-10-26']

const meta = {
  title: 'Molecules/VersusHistory',
  component: VersusHistory,
  args: {
    artists: [feid, miko],
    days: 4,
    history: {
      [feid.slug]: days.map((day, i) => ({ day, lastfmListeners: 1_200_000 + i * 15_000, deezerFans: 900_000 + i * 2_000, fame: 92 })),
      [miko.slug]: days.map((day, i) => ({ day, lastfmListeners: 800_000 + i * 40_000, deezerFans: 400_000 + i * 9_000, fame: 85 + i })),
    },
  },
  decorators: [(Story) => <div data-perreo-ui="" data-domain="perreo" className="w-[360px] p-3 text-white"><Story /></div>],
} satisfies Meta<typeof VersusHistory>
export default meta
type Story = StoryObj<typeof meta>

/** Varios días de pulso: una línea por artista y su crecimiento. */
export const Evolucion: Story = {}

/** Primer día: el aviso honesto. */
export const EmpiezaHoy: Story = { args: { days: 1 } }
