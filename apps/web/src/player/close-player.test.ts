import { describe, expect, it, vi } from 'vitest'
import { closePlayback, MEDIA_ACTIONS } from './close-player'

const session = () => ({
  metadata: {} as MediaMetadata | null,
  playbackState: 'playing' as MediaSessionPlaybackState,
  setActionHandler: vi.fn(),
  setPositionState: vi.fn(),
})

describe('closePlayback', () => {
  it('para el audio y le quita la fuente', () => {
    const audio = { pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn() }
    closePlayback({ audio })
    expect(audio.pause).toHaveBeenCalled()
    expect(audio.removeAttribute).toHaveBeenCalledWith('src')
    expect(audio.load).toHaveBeenCalled()
  })

  it('para y destruye el IFrame de YouTube', () => {
    const video = { stopVideo: vi.fn(), destroy: vi.fn() }
    closePlayback({ video })
    expect(video.stopVideo).toHaveBeenCalled()
    expect(video.destroy).toHaveBeenCalled()
  })

  it('no falla si el IFrame ya no está', () => {
    const video = { stopVideo: vi.fn(() => { throw new Error('gone') }), destroy: vi.fn() }
    expect(() => closePlayback({ video })).not.toThrow()
  })

  it('vacía la Media Session y quita todos sus botones', () => {
    const s = session()
    closePlayback({ mediaSession: s })
    expect(s.metadata).toBeNull()
    expect(s.playbackState).toBe('none')
    for (const action of MEDIA_ACTIONS) expect(s.setActionHandler).toHaveBeenCalledWith(action, null)
    expect(s.setPositionState).toHaveBeenCalledWith()
  })

  it('sigue aunque el navegador no admita alguna acción', () => {
    const s = { ...session(), setActionHandler: vi.fn(() => { throw new TypeError('no') }) }
    expect(() => closePlayback({ mediaSession: s })).not.toThrow()
    expect(s.metadata).toBeNull()
  })
})
