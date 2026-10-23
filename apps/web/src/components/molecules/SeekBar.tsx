import { Slider } from '@/components/ui/slider'
import { formatDuration } from '@/lib/format'

interface SeekBarProps {
  position: number
  duration: number
  onSeek: (seconds: number) => void
}

export function SeekBar({ position, duration, onSeek }: SeekBarProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Slider
        aria-label="Posición"
        min={0}
        max={Math.max(1, Math.floor(duration))}
        step={1}
        value={[Math.min(position, duration || 0)]}
        onValueChange={([v]) => onSeek(v)}
      />
      <div className="flex justify-between font-mono text-xs tabular-nums text-muted-foreground">
        <span>{formatDuration(position)}</span>
        <span>{formatDuration(duration)}</span>
      </div>
    </div>
  )
}
