import {
  ArrowLeft,
  Check,
  Contrast,
  Home,
  Library,
  ListMusic,
  type LucideProps,
  MoreHorizontal,
  Pause,
  Play,
  Sparkles,
  SkipBack,
  SkipForward,
  Undo2,
  X,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  RefreshCw,
  BookOpen,
  Clapperboard,
  ExternalLink,
  Gamepad2,
  LayoutGrid,
  Music,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Catálogo cerrado de iconos: la UI solo usa estos y el nombre describe el gesto. */
const ICONS = {
  back: ArrowLeft,
  books: BookOpen,
  domains: LayoutGrid,
  external: ExternalLink,
  games: Gamepad2,
  movies: Clapperboard,
  music: Music,
  search: Search,
  bookmark: Bookmark,
  bookmarked: BookmarkCheck,
  check: Check,
  chevronDown: ChevronDown,
  close: X,
  home: Home,
  library: Library,
  lists: ListMusic,
  more: MoreHorizontal,
  next: SkipForward,
  pause: Pause,
  play: Play,
  previous: SkipBack,
  retry: RefreshCw,
  sparkles: Sparkles,
  theme: Contrast,
  undo: Undo2,
}

export type IconName = keyof typeof ICONS

export function Icon({ name, className, ...props }: LucideProps & { name: IconName }) {
  const Component = ICONS[name]
  const filled = name === 'play' || name === 'pause' || name === 'next' || name === 'previous'
  return (
    <Component
      aria-hidden
      className={cn('size-5', className)}
      fill={filled ? 'currentColor' : 'none'}
      strokeWidth={filled ? 1.5 : 2}
      {...props}
    />
  )
}
