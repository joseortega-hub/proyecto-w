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
  Heart,
  ThumbsUp,
  ThumbsDown,
  Mic,
  Square,
  Trash2,
  Sun,
  Moon,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Wand2,
  ListPlus,
  TvMinimalPlay,
  Unplug,
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
  heart: Heart,
  thumbsUp: ThumbsUp,
  thumbsDown: ThumbsDown,
  mic: Mic,
  stop: Square,
  trash: Trash2,
  wand: Wand2,
  sun: Sun,
  moon: Moon,
  cloud: Cloud,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
  fog: CloudFog,
  youtube: TvMinimalPlay,
  listPlus: ListPlus,
  unplug: Unplug,
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
