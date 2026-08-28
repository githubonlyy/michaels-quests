import { useEffect } from 'react'
import { X, Heart, Trophy, Timer } from 'lucide-react'
import { useTheme } from '../context/ThemeContext.jsx'
import { speak } from '../match/speak.js'

// Fixed spots for the floating decoration emoji so they never jump between renders.
// Positions are physical (left/top) on purpose — the play area is a canvas-like
// surface, not reading-order content, so RTL does not apply.
const SPOTS = [
  { left: '6%', top: '10%', size: 'text-3xl', dur: '3.4s', delay: '0s' },
  { left: '84%', top: '16%', size: 'text-2xl', dur: '4.1s', delay: '0.6s' },
  { left: '18%', top: '58%', size: 'text-2xl', dur: '3.8s', delay: '1.1s' },
  { left: '72%', top: '66%', size: 'text-3xl', dur: '3.1s', delay: '0.3s' },
  { left: '46%', top: '30%', size: 'text-xl', dur: '4.6s', delay: '1.7s' },
  { left: '90%', top: '44%', size: 'text-xl', dur: '3.6s', delay: '0.9s' },
]

/**
 * Soft theme-gradient backdrop with a few bobbing particle emoji. Rendered
 * behind every game; canvases above it stay transparent (clearRect, not fill).
 */
export function ArcadeBackdrop() {
  const { theme } = useTheme()
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ background: 'linear-gradient(to bottom, var(--t-bg-from), var(--t-bg-to))' }}
    >
      {SPOTS.map((s, i) => (
        <span
          key={i}
          className={`absolute ${s.size} opacity-40 anim-float-bob select-none`}
          style={{ left: s.left, top: s.top, animationDuration: s.dur, animationDelay: s.delay }}
        >
          {theme.particles[i % theme.particles.length]}
        </span>
      ))}
    </div>
  )
}

/**
 * Shared arcade chrome: HUD bar (timer / title+score / hearts), themed backdrop,
 * and the Hebrew game-over card. The game itself renders as children inside the
 * play area. Speaks "שיא חדש!" / "נגמר המשחק" when the round ends.
 */
export default function ArcadeShell({ title, hud, over, highScore, onClose, onRestart, wrapRef, children }) {
  useEffect(() => {
    if (over) speak(over.isRecord ? 'שיא חדש!' : 'נגמר המשחק')
  }, [over])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-(--t-side-deep)">
      {/* HUD */}
      <div className="flex items-center gap-3 px-3 py-2 bg-(--t-side) border-b-4 border-(--t-side-deep)">
        <button
          onClick={onClose}
          aria-label="יציאה"
          className="w-16 h-16 shrink-0 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-2xl flex items-center justify-center transition-all"
        >
          <X size={30} strokeWidth={3} />
        </button>
        {hud.time !== undefined && (
          <div className="flex items-center gap-1.5 text-white font-black text-2xl tabular-nums">
            <Timer size={24} className="text-(--t-accent)" /> {hud.time}
          </div>
        )}
        <div className="flex-1 text-center leading-tight min-w-0">
          {title && <div className="text-(--t-text-soft) font-bold text-sm truncate">{title}</div>}
          <div className="text-(--t-accent) font-black text-3xl tabular-nums drop-shadow">{hud.score}</div>
        </div>
        {hud.lives !== undefined && (
          <div className="flex gap-1" aria-label={`${hud.lives} לבבות`}>
            {Array.from({ length: hud.maxLives ?? 3 }).map((_, i) => (
              <Heart
                key={i}
                size={26}
                className={i < hud.lives ? 'text-pink-400 fill-pink-400 drop-shadow' : 'text-white/30 fill-white/15'}
              />
            ))}
          </div>
        )}
      </div>

      {/* PLAY AREA */}
      <div ref={wrapRef} className="flex-1 relative touch-none overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <ArcadeBackdrop />
        {children}
      </div>

      {/* GAME OVER */}
      {over && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-(--t-overlay) backdrop-blur-sm p-4">
          <div className="anim-zoom-in bg-white rounded-3xl border-8 border-(--t-side-deep) shadow-2xl w-full max-w-sm overflow-hidden text-center">
            <div className="p-5 bg-gradient-to-br from-(--t-bg-from) to-(--t-bg-to) border-b-8 border-black/10">
              <div className="text-5xl mb-1 drop-shadow">{over.isRecord ? '🏆' : '🌟'}</div>
              <h2 className="text-3xl font-black text-white drop-shadow-md">
                {over.isRecord ? 'שיא חדש!' : 'נגמר המשחק'}
              </h2>
            </div>
            <div className="p-6 flex flex-col items-center gap-4 bg-slate-50">
              <p className="text-5xl font-black text-slate-800 tabular-nums">{over.score}</p>
              <div className="flex items-center gap-2 text-slate-500 font-bold">
                <Trophy size={18} className="text-yellow-500 fill-yellow-200" />
                <span className="tabular-nums">שיא: {Math.max(highScore, over.score)}</span>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={onRestart}
                  className="flex-1 min-h-16 bg-pink-500 hover:bg-pink-400 text-white text-xl font-black rounded-2xl border-b-8 border-pink-700 active:border-b-0 active:translate-y-2 transition-all"
                >
                  עוד פעם 🔁
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 min-h-16 bg-violet-500 hover:bg-violet-400 text-white text-xl font-black rounded-2xl border-b-8 border-violet-700 active:border-b-0 active:translate-y-2 transition-all"
                >
                  יציאה
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
