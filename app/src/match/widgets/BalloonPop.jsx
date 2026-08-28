import { useRef, useState } from 'react'
import { sfx } from '../sounds.js'
import { useTheme } from '../../context/ThemeContext.jsx'

// four saturated balloon colors per world (white text must stay readable)
const PALETTES = {
  cars: ['#ef4444', '#f97316', '#0ea5e9', '#111827'],
  dinos: ['#16a34a', '#65a30d', '#f97316', '#0d9488'],
  space: ['#6366f1', '#0ea5e9', '#a855f7', '#f43f5e'],
}
const FALLBACK = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7']

const SHARDS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2
  return {
    id: i,
    dx: `${Math.round(Math.cos(angle) * 60)}px`,
    dy: `${Math.round(Math.sin(angle) * 60)}px`,
    rot: `${180 + i * 45}deg`,
  }
})

// emoji / single letters / short numbers get the giant font
const labelSize = (label) => (Array.from(String(label)).length <= 2 ? 'text-5xl md:text-6xl' : 'text-2xl md:text-3xl')

/**
 * Arcade mode: answers float in balloons — pop the right one.
 * Tap right: balloon inflates then BURSTS (shards + flash + POP!).
 * Tap wrong: that balloon deflates sadly, then the correct one pops itself.
 */
export default function BalloonPop({ question, disabled, onAnswer }) {
  const { theme } = useTheme()
  const colors = PALETTES[theme?.id] ?? FALLBACK
  // phases per balloon index: 'inflate' -> 'popped'; 'deflate' for a wrong tap
  const [popped, setPopped] = useState(null)
  const [inflating, setInflating] = useState(null)
  const [deflating, setDeflating] = useState(null)
  const lockRef = useRef(false)

  const correctIdx = question.options.findIndex((o) => o.correct)

  const tap = (opt, i) => {
    if (disabled || lockRef.current) return
    lockRef.current = true
    if (opt.correct) {
      setInflating(i)
      setTimeout(() => { setInflating(null); setPopped(i); sfx.pop() }, 180)
      onAnswer(true, 700) // answer locks in now; engine shows feedback after the pop
    } else {
      setDeflating(i)
      sfx.buzz()
      // then show the right answer popping itself
      setTimeout(() => { setPopped(correctIdx); sfx.pop() }, 650)
      onAnswer(false, 1250)
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {question.emoji && <span className="text-6xl">{question.emoji}</span>}

      <div className="grid grid-cols-2 gap-4 md:gap-6 w-full max-w-md">
        {question.options.map((opt, i) => {
          const color = colors[i % colors.length]
          const isPopped = popped === i
          return (
            <div key={i} className="relative aspect-square max-w-44 mx-auto w-full">
              {/* burst remains */}
              {isPopped && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <div className="anim-pop-flash absolute inset-[15%] rounded-full bg-white"></div>
                  {SHARDS.map((s) => (
                    <div
                      key={s.id}
                      className="anim-balloon-shard absolute left-1/2 top-1/2 w-3.5 h-5 -ml-2 -mt-2.5 rounded-[40%_60%_50%_50%]"
                      style={{ '--dx': s.dx, '--dy': s.dy, '--rot': s.rot, backgroundColor: color }}
                    ></div>
                  ))}
                  <span className="anim-pop-text absolute inset-0 flex items-center justify-center text-3xl font-black italic text-slate-800 drop-shadow-md">
                    פּוֹפּ!
                  </span>
                </div>
              )}

              {!isPopped && (
                <button
                  onClick={() => tap(opt, i)}
                  disabled={disabled}
                  className={`absolute inset-0 flex items-center justify-center rounded-full border-b-8 shadow-xl
                    transition-transform select-none text-white font-black drop-shadow-md p-2 ${labelSize(opt.label)}
                    ${inflating === i ? 'anim-balloon-inflate' : deflating === i ? 'anim-balloon-deflate' : 'anim-float-bob active:scale-90'}
                  `}
                  style={{
                    background: `linear-gradient(to bottom, color-mix(in srgb, ${color} 65%, white), ${color})`,
                    borderColor: `color-mix(in srgb, ${color} 65%, black)`,
                    animationDelay: inflating === i || deflating === i ? '0s' : `${i * 0.35}s`,
                  }}
                >
                  {/* balloon shine */}
                  <span className="absolute top-3 left-4 w-6 h-4 bg-white/40 rounded-full rotate-[-25deg]"></span>
                  <span dir="auto" className="break-words leading-tight">{opt.label}</span>
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
