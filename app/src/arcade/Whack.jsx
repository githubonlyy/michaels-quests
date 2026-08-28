import { useEffect, useRef, useState } from 'react'
import { sfx } from '../match/sounds.js'
import { useTheme } from '../context/ThemeContext.jsx'
import ArcadeShell from './ArcadeShell.jsx'

const ROUND_SEC = 45
const START_LIVES = 3
const HOLES = 9

/**
 * Whack — the theme's `good` emoji pops up from soft round spots; tap it fast.
 * Don't tap the `bad` one (costs a heart). Tuned gently for a first grader: longer pop-up time, slower cadence, fewer hazards.
 */
export default function Whack({ highScore, onClose, onScore, onRestart }) {
  const { theme } = useTheme()
  const skin = theme.arcade.whack
  const [hud, setHud] = useState({ score: 0, lives: START_LIVES, time: ROUND_SEC })
  const [active, setActive] = useState(null) // { idx, kind, id }
  const [smashed, setSmashed] = useState(null) // idx just hit (for fx)
  const [over, setOver] = useState(null)
  const stateRef = useRef({ score: 0, lives: START_LIVES, done: false })
  const reportedRef = useRef(false)

  // round timer
  useEffect(() => {
    const start = Date.now()
    const iv = setInterval(() => {
      const left = Math.max(0, ROUND_SEC - Math.round((Date.now() - start) / 1000))
      setHud((h) => (h.time === left ? h : { ...h, time: left }))
      if (left <= 0) endRound()
    }, 250)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // spawner: pop a good (or bad) sprite in a random spot, gently faster over time
  useEffect(() => {
    let timeout
    let popId = 0
    const start = Date.now()
    const spawn = () => {
      if (stateRef.current.done) return
      const elapsed = (Date.now() - start) / 1000
      const kind = Math.random() < 0.18 ? 'bad' : 'good'
      const idx = Math.floor(Math.random() * HOLES)
      const id = ++popId
      setActive({ idx, kind, id })
      const upFor = Math.max(800, 1300 - elapsed * 8)
      timeout = setTimeout(() => {
        setActive((a) => (a?.id === id ? null : a))
        timeout = setTimeout(spawn, Math.max(260, 550 - elapsed * 4))
      }, upFor)
    }
    timeout = setTimeout(spawn, 700)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const endRound = () => {
    const s = stateRef.current
    if (s.done) return
    s.done = true
    const isRecord = s.score > highScore
    if (isRecord) sfx.fanfare()
    setOver({ score: s.score, isRecord })
  }

  const smash = (idx) => {
    const s = stateRef.current
    if (s.done || !active || active.idx !== idx) return
    setSmashed(idx)
    setTimeout(() => setSmashed(null), 250)
    if (active.kind === 'good') {
      s.score += 10
      sfx.pop()
    } else {
      s.lives -= 1
      sfx.buzz()
      if (s.lives <= 0) {
        setHud((h) => ({ ...h, score: s.score, lives: 0 }))
        setActive(null)
        endRound()
        return
      }
    }
    setHud((h) => ({ ...h, score: s.score, lives: s.lives }))
    setActive(null)
  }

  useEffect(() => {
    if (!over || reportedRef.current) return
    reportedRef.current = true
    onScore(over.score)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over])

  return (
    <ArcadeShell title={skin.title} hud={hud} over={over} highScore={highScore} onClose={onClose} onRestart={onRestart}>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="grid grid-cols-3 gap-3 md:gap-5 w-full max-w-md">
          {Array.from({ length: HOLES }).map((_, i) => {
            const isUp = active?.idx === i
            const isBad = isUp && active.kind === 'bad'
            const hit = smashed === i
            return (
              <button
                key={i}
                type="button"
                onPointerDown={() => smash(i)}
                aria-label={isUp ? (isBad ? `${skin.bad} — לא לגעת` : `${skin.good} — לתפוס`) : 'ריק'}
                className="relative aspect-square min-h-16 rounded-full bg-(--t-panel) border-4 border-(--t-panel-border) shadow-inner overflow-hidden select-none"
              >
                {/* soft shadow at the bottom of the spot */}
                <span className="absolute inset-x-4 bottom-3 h-3 rounded-full bg-black/20"></span>
                {isUp && (
                  <span
                    className={`absolute inset-2 rounded-full flex items-center justify-center anim-pop border-b-4 bg-white/95
                      ${isBad ? 'border-slate-300' : 'border-(--t-accent-deep)'}
                      ${hit ? 'anim-scatter-shake' : ''}`}
                  >
                    <span className="text-5xl md:text-6xl leading-none">{isBad ? skin.bad : skin.good}</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </ArcadeShell>
  )
}
