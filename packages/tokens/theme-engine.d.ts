export type Mode = 'light' | 'dark'
export type ShadowLayer = [number, number, number, number, string, number]
export type ModeColors = Record<string, string>
export interface ThemeBase {
  background: string
  foreground: string
  card: string
  primary: string
  'primary-foreground': string
  secondary: string
  'muted-foreground': string
  accent: string
  'accent-foreground': string
  border: string
}
export interface ThemeProposal {
  name: string
  radius: number
  shadow: 'suave' | 'brillo' | 'duras'
  font: 'sintonia' | 'inter' | 'unbounded' | 'fraunces' | 'space-grotesk'
  light: ThemeBase
  dark: ThemeBase
}
export interface ResolvedMode {
  colors: ModeColors
  domains: Record<string, string>
  shadow: Record<string, ShadowLayer[]>
}
export interface ResolvedTheme {
  label: string
  fonts: { display: string[]; body: string[]; mono: string[] }
  load: string[]
  radius: number
  modes: Record<Mode, ResolvedMode>
}
export const MODES: Mode[]
export const SHADOW_STYLES: ProposalShadow[]
type ProposalShadow = ThemeProposal['shadow']
export const FONT_CHOICES: Record<ThemeProposal['font'], { label: string; fonts: object; load: string[] }>
export function contrast(a: string, b: string): number
export function fixContrast(hex: string, backgrounds: string[], min?: number): { hex: string; direction: 'darker' | 'lighter' | null }
export function fixBase(base: ThemeBase, mode: Mode): { base: ThemeBase; fixes: { mode: Mode; field: string; label: string; direction: string }[] }
export function failingPairs(colors: ModeColors, domains: Record<string, string>): string[]
export function buildTheme(raw: ThemeProposal): { theme: ResolvedTheme; notices: string[] }
export function themeCss(id: string, theme: ResolvedTheme): string
export function menuModes(theme: ResolvedTheme): Record<Mode, { swatches: string[]; themeColor: string }>
