import { Pause, Play, RotateCcw, Scissors, Volume2, VolumeX } from 'lucide-react'
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const FRAMES = 10
// Handles pull to whole seconds within this many px.
const SNAP_PX = 5

type Part = 'start' | 'end' | 'range' | 'seek'

export interface ClipRange {
  start: number
  end: number
}

export interface ClipTrimmerProps {
  /** Video object URL or remote video URL */
  src: string
  /** Video total duration in seconds */
  duration: number
  /** Current controlled/initial range */
  value: ClipRange
  /** Minimum allowed clip length in seconds */
  minLength?: number
  /** Maximum allowed clip length in seconds (e.g. 30s) */
  maxLength?: number
  /** Video orientation hint for preview frame */
  aspectMode?: 'landscape' | 'portrait'
  onChange: (range: ClipRange) => void
  className?: string
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const roundTenth = (v: number) => Math.round(v * 10) / 10

const formatClock = (s: number) => {
  const safe = Math.max(0, Number.isFinite(s) ? s : 0)
  const tenths = Math.round(safe * 10)
  const whole = Math.floor(tenths / 10)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${tenths % 10}`
}

function chooseLabelStep(duration: number): number {
  if (duration <= 15) return 3
  if (duration <= 35) return 5
  if (duration <= 90) return 15
  if (duration <= 180) return 30
  return 60
}

export function ClipTrimmer({
  src,
  duration,
  value,
  minLength = 3,
  maxLength = 30,
  aspectMode = 'landscape',
  onChange,
  className = '',
}: ClipTrimmerProps) {
  const safeDuration = Math.max(0.5, duration || 0.5)
  const effectiveMin = Math.min(minLength, safeDuration)
  const effectiveMax = Math.min(Math.max(effectiveMin, maxLength), safeDuration)

  const [time, setTime] = useState(value.start)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [active, setActive] = useState<Part | null>(null)
  const [snapped, setSnapped] = useState<number | null>(null)
  const [frames, setFrames] = useState<string[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const rangeRef = useRef<ClipRange>(value)
  const timeRef = useRef<number>(time)
  const drag = useRef<{
    part: Part
    x: number
    from: ClipRange
    moved: boolean
  } | null>(null)

  rangeRef.current = value

  // Keep playhead within bounds when external range changes.
  useEffect(() => {
    if (timeRef.current < value.start || timeRef.current > value.end) {
      const next = clamp(timeRef.current, value.start, value.end)
      timeRef.current = next
      setTime(next)
      if (videoRef.current && Math.abs(videoRef.current.currentTime - next) > 0.08) {
        try {
          videoRef.current.currentTime = next
        } catch {
          /* ignore */
        }
      }
    }
  }, [value.start, value.end])

  // Extract lightweight filmstrip frame thumbnails from the video source.
  useEffect(() => {
    if (!src || safeDuration < 0.5) {
      setFrames([])
      return
    }
    let cancelled = false
    const probe = document.createElement('video')
    probe.muted = true
    probe.playsInline = true
    probe.crossOrigin = 'anonymous'
    probe.preload = 'auto'
    probe.src = src

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    const captureFrames = async () => {
      if (!ctx || cancelled) return
      const vw = probe.videoWidth || 320
      const vh = probe.videoHeight || 180
      const targetW = 96
      const targetH = Math.max(48, Math.round((vh / vw) * targetW))
      canvas.width = targetW
      canvas.height = targetH

      const out: string[] = []
      for (let i = 0; i < FRAMES; i++) {
        if (cancelled) return
        const t = FRAMES > 1 ? (i / (FRAMES - 1)) * Math.max(0.1, safeDuration - 0.15) : 0
        await new Promise<void>((resolve) => {
          let settled = false
          const finish = () => {
            if (settled) return
            settled = true
            probe.removeEventListener('seeked', finish)
            resolve()
          }
          probe.addEventListener('seeked', finish, { once: true })
          window.setTimeout(finish, 450)
          try {
            probe.currentTime = t
          } catch {
            finish()
          }
        })
        if (cancelled) return
        try {
          ctx.drawImage(probe, 0, 0, targetW, targetH)
          out.push(canvas.toDataURL('image/jpeg', 0.55))
        } catch {
          // Cross-origin tainted canvas: fall back cleanly to neutral filmstrip bars.
          return
        }
      }
      if (!cancelled && out.length > 0) {
        setFrames(out)
      }
    }

    probe.addEventListener('loadeddata', () => {
      void captureFrames()
    }, { once: true })

    return () => {
      cancelled = true
      probe.pause()
      probe.removeAttribute('src')
      probe.load()
    }
  }, [src, safeDuration])

  // Sync actual <video> playback loop strictly inside [start, end].
  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    if (!playing) {
      vid.pause()
      return
    }
    if (vid.currentTime < rangeRef.current.start || vid.currentTime >= rangeRef.current.end - 0.05) {
      try {
        vid.currentTime = rangeRef.current.start
      } catch {
        /* ignore */
      }
    }
    const p = vid.play()
    if (p && typeof p.catch === 'function') {
      p.catch(() => setPlaying(false))
    }

    let frame = 0
    const syncPlayhead = () => {
      const { start, end } = rangeRef.current
      let curr = vid.currentTime
      if (curr >= end || curr < start - 0.05 || vid.ended) {
        curr = start
        try {
          vid.currentTime = start
        } catch {
          /* ignore */
        }
      }
      timeRef.current = curr
      setTime(curr)
      frame = requestAnimationFrame(syncPlayhead)
    }
    frame = requestAnimationFrame(syncPlayhead)
    return () => {
      cancelAnimationFrame(frame)
      vid.pause()
    }
  }, [playing])

  const seek = (t: number) => {
    const next = clamp(t, rangeRef.current.start, rangeRef.current.end)
    timeRef.current = next
    setTime(next)
    const vid = videoRef.current
    if (vid) {
      try {
        vid.currentTime = next
      } catch {
        /* ignore */
      }
    }
  }

  const pxPerSecond = () => (stripRef.current?.getBoundingClientRect().width ?? 1) / safeDuration

  const secondsAt = (clientX: number) => {
    const rect = stripRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return 0
    return clamp(((clientX - rect.left) / rect.width) * safeDuration, 0, safeDuration)
  }

  // A handle near a whole second pulls onto it, like a magnet.
  const snap = (t: number) => {
    const whole = Math.round(t)
    if (Math.abs(whole - t) * pxPerSecond() < SNAP_PX) {
      setSnapped(whole)
      return whole
    }
    setSnapped(null)
    return t
  }

  const commitRange = (next: ClipRange, previewAt: number) => {
    const start = roundTenth(clamp(next.start, 0, safeDuration - effectiveMin))
    const end = roundTenth(
      clamp(
        next.end,
        Math.min(safeDuration, start + effectiveMin),
        Math.min(safeDuration, start + effectiveMax)
      )
    )
    const clean: ClipRange = { start, end }
    rangeRef.current = clean
    onChange(clean)
    const clampedAt = clamp(previewAt, clean.start, clean.end)
    timeRef.current = clampedAt
    setTime(clampedAt)
    if (videoRef.current) {
      try {
        videoRef.current.currentTime = clampedAt
      } catch {
        /* ignore */
      }
    }
  }

  const moveHandle = (part: 'start' | 'end', rawT: number) => {
    const { start, end } = rangeRef.current
    const snappedT = snap(rawT)
    if (part === 'start') {
      // Respect both minLength and maxLength.
      const minStart = Math.max(0, end - effectiveMax)
      const maxStart = Math.max(0, end - effectiveMin)
      const nextStart = clamp(snappedT, minStart, maxStart)
      commitRange({ start: nextStart, end }, nextStart)
    } else {
      const minEnd = Math.min(safeDuration, start + effectiveMin)
      const maxEnd = Math.min(safeDuration, start + effectiveMax)
      const nextEnd = clamp(snappedT, minEnd, maxEnd)
      commitRange({ start, end: nextEnd }, nextEnd)
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || drag.current) return
    const target = event.target as HTMLElement
    const part = (target.closest('[data-part]')?.getAttribute('data-part') ?? 'seek') as Part
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { part, x: event.clientX, from: rangeRef.current, moved: false }
    setActive(part)
    if (part === 'start' || part === 'end') {
      setPlaying(false)
    } else if (part === 'seek') {
      seek(secondsAt(event.clientX))
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dx = event.clientX - d.x
    if (Math.abs(dx) > 3) d.moved = true
    const deltaSec = dx / pxPerSecond()

    if (d.part === 'start' || d.part === 'end') {
      moveHandle(d.part, d.from[d.part] + deltaSec)
    } else if (d.part === 'range' && d.moved) {
      const length = d.from.end - d.from.start
      const nextStart = clamp(d.from.start + deltaSec, 0, safeDuration - length)
      commitRange({ start: nextStart, end: nextStart + length }, nextStart)
    } else if (d.part === 'seek') {
      seek(secondsAt(event.clientX))
    }
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    if (d.part === 'range' && !d.moved) {
      seek(secondsAt(event.clientX))
    } else if (d.part === 'start' || d.part === 'end') {
      seek(rangeRef.current.start)
    }
    drag.current = null
    setActive(null)
    setSnapped(null)
  }

  const handleKeyDown =
    (part: 'start' | 'end') => (event: KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 1 : 0.5
      const moves: Record<string, number> = {
        ArrowLeft: -step,
        ArrowDown: -step,
        ArrowRight: step,
        ArrowUp: step,
        Home: -safeDuration,
        End: safeDuration,
      }
      const move = moves[event.key]
      if (move === undefined) return
      event.preventDefault()
      setPlaying(false)
      moveHandle(part, rangeRef.current[part] + move)
    }

  const togglePlay = () => {
    if (!playing && timeRef.current >= value.end - 0.08) {
      seek(value.start)
    }
    setPlaying((p) => !p)
  }

  const resetRange = () => {
    setPlaying(false)
    const nextEnd = Math.min(safeDuration, effectiveMax)
    commitRange({ start: 0, end: nextEnd }, 0)
  }

  const pct = (t: number) => clamp((t / safeDuration) * 100, 0, 100)
  const kept = Math.max(0, value.end - value.start)
  const trimming = active === 'start' || active === 'end'
  const labelEvery = chooseLabelStep(safeDuration)
  const ticks = useMemo(() => {
    const maxTick = Math.floor(safeDuration)
    const tickStep = safeDuration > 90 ? 5 : safeDuration > 45 ? 2 : 1
    const arr: number[] = []
    for (let s = 0; s <= maxTick; s += tickStep) {
      arr.push(s)
    }
    return arr
  }, [safeDuration])

  const defaultEnd = roundTenth(Math.min(safeDuration, effectiveMax))
  const isAtDefault = Math.abs(value.start) < 0.05 && Math.abs(value.end - defaultEnd) < 0.05

  return (
    <div className={`clip-trimmer ${className}`.trim()}>
      {/* Header strip */}
      <div className="clip-trimmer-head">
        <div className="clip-trimmer-title">
          <Scissors size={15} color="#1d4ed8" />
          <span>Potong Durasi Klip</span>
        </div>
        <span className="clip-trimmer-badge">
          {kept.toFixed(1)} dtk / maks {effectiveMax.toFixed(0)} dtk
        </span>
      </div>

      {/* Video preview stage */}
      <div className={`clip-trimmer-stage ${aspectMode === 'portrait' ? 'is-portrait' : ''}`}>
        <video
          ref={videoRef}
          src={src}
          muted={muted}
          playsInline
          preload="auto"
          className="clip-trimmer-video"
          onClick={togglePlay}
        />

        <span className="clip-trimmer-clock">{formatClock(time)}</span>

        <div className="clip-trimmer-stage-actions">
          <button
            type="button"
            className="clip-trimmer-icon-btn"
            aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button
            type="button"
            className="clip-trimmer-icon-btn"
            aria-label={playing ? 'Jeda preview' : 'Putar potongan'}
            onClick={togglePlay}
          >
            {playing ? (
              <Pause size={15} fill="currentColor" />
            ) : (
              <Play size={15} fill="currentColor" style={{ transform: 'translateX(1px)' }} />
            )}
          </button>
        </div>
      </div>

      {/* Filmstrip + draggable trim handles */}
      <div className="clip-trimmer-track-pad">
        <div
          ref={stripRef}
          className="clip-trimmer-strip"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        >
          {/* Filmstrip frames */}
          <div className="clip-trimmer-filmstrip" aria-hidden="true">
            {Array.from({ length: FRAMES }, (_, i) => (
              <div className="clip-trimmer-frame" key={i}>
                {frames[i] ? (
                  <img src={frames[i]} alt="" draggable={false} className="clip-trimmer-frame-img" />
                ) : (
                  <div className="clip-trimmer-frame-fallback" />
                )}
              </div>
            ))}
          </div>

          {/* Dimmed cut regions (GPU transform only) */}
          <div className="clip-trimmer-dim-layer" aria-hidden="true">
            <div
              className="clip-trimmer-dim-mask"
              style={{ transform: `translateX(${pct(value.start) - 100}%)` }}
            />
            <div
              className="clip-trimmer-dim-mask"
              style={{ transform: `translateX(${pct(value.end)}%)` }}
            />
          </div>

          {/* Playhead */}
          <div
            className={`clip-trimmer-playhead-wrap ${trimming ? 'is-hidden' : ''}`}
            style={{ transform: `translateX(${pct(time)}%)` }}
            aria-hidden="true"
          >
            <div className="clip-trimmer-playhead-line">
              <span className="clip-trimmer-playhead-dot" />
            </div>
          </div>

          {/* Kept selection frame & drag handles */}
          <div
            className={`clip-trimmer-range ${active === 'range' ? 'is-grabbing' : ''}`}
            data-part="range"
            style={{
              left: `${pct(value.start)}%`,
              width: `${pct(kept)}%`,
            }}
          >
            {(['start', 'end'] as const).map((part) => (
              <div
                key={part}
                role="slider"
                tabIndex={0}
                aria-label={part === 'start' ? 'Titik awal potongan' : 'Titik akhir potongan'}
                aria-valuemin={0}
                aria-valuemax={Math.round(safeDuration * 10) / 10}
                aria-valuenow={Math.round(value[part] * 10) / 10}
                aria-valuetext={`${value[part].toFixed(1)} detik`}
                data-part={part}
                onKeyDown={handleKeyDown(part)}
                className={`clip-trimmer-handle clip-trimmer-handle--${part} ${active === part ? 'is-active' : ''}`}
              >
                <span className="clip-trimmer-handle-grip" />
                <span className={`clip-trimmer-tooltip ${active === part ? 'is-visible' : ''}`}>
                  {formatClock(value[part])}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Ruler */}
        <div className="clip-trimmer-ruler" aria-hidden="true">
          {ticks.map((s) => {
            const showLabel = s % labelEvery === 0
            const isSnapped = snapped === s
            return (
              <span
                key={s}
                className="clip-trimmer-tick"
                style={{ left: `${pct(s)}%` }}
              >
                <span
                  className={`clip-trimmer-tick-bar ${showLabel ? 'is-major' : ''} ${isSnapped ? 'is-snapped' : ''}`}
                />
                {showLabel && (
                  <span className={`clip-trimmer-tick-label ${isSnapped ? 'is-snapped' : ''}`}>
                    {s}s
                  </span>
                )}
              </span>
            )
          })}
        </div>
      </div>

      {/* Footer summary + Reset */}
      <div className="clip-trimmer-footer">
        <div className="clip-trimmer-summary">
          <strong>{formatClock(value.start)}</strong>
          <span>–</span>
          <strong>{formatClock(value.end)}</strong>
          <span className="clip-trimmer-dot">•</span>
          <span>
            <strong>{kept.toFixed(1)} dtk</strong> dari {safeDuration.toFixed(1)} dtk
          </span>
        </div>
        <button
          type="button"
          className="clip-trimmer-reset-btn"
          disabled={isAtDefault}
          onClick={resetRange}
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>
    </div>
  )
}
