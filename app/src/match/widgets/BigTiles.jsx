import { useRef, useState } from 'react'
import { sfx } from '../sounds.js'

/* ---- inline SVG shapes (viewBox 0 0 100 100), each with its own fun fill ---- */
const SHAPES = {
  circle: { color: '#f43f5e', el: <circle cx="50" cy="50" r="42" /> },
  square: { color: '#3b82f6', el: <rect x="10" y="10" width="80" height="80" rx="6" /> },
  triangle: { color: '#22c55e', el: <polygon points="50,8 92,88 8,88" /> },
  rectangle: { color: '#f97316', el: <rect x="5" y="25" width="90" height="50" rx="5" /> },
  star: {
    color: '#facc15',
    el: <polygon points="50,5 61.2,34.6 92.8,36.1 68.1,55.9 76.5,86.4 50,69 23.5,86.4 31.9,55.9 7.2,36.1 38.8,34.6" />,
  },
  heart: {
    color: '#ec4899',
    el: <path d="M50,90 C50,90 8,62 8,34 C8,20 19,10 31,10 C40,10 47,15 50,22 C53,15 60,10 69,10 C81,10 92,20 92,34 C92,62 50,90 50,90 Z" />,
  },
  oval: { color: '#a855f7', el: <ellipse cx="50" cy="50" rx="46" ry="30" /> },
  diamond: { color: '#06b6d4', el: <polygon points="50,5 92,50 50,95 8,50" /> },
  pentagon: { color: '#84cc16', el: <polygon points="50,5 92.8,36.1 76.5,86.4 23.5,86.4 7.2,36.1" /> },
  hexagon: { color: '#8b5cf6', el: <polygon points="95,50 72.5,89 27.5,89 5,50 27.5,11 72.5,11" /> },
  crescent: { color: '#fbbf24', el: <path d="M60,8 A42,42 0 1,0 60,92 A50,50 0 0,1 60,8 Z" /> },
}

export function ShapeSvg({ name, size = 96, className = '' }) {
  const s = SHAPES[name]
  if (!s) return <span className="text-4xl">❓</span>
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      fill={s.color}
      stroke="rgba(0,0,0,0.35)"
      strokeWidth="3"
      strokeLinejoin="round"
      aria-label={name}
    >
      {s.el}
    </svg>
  )
}

const STARS = Array.from({ length: 6 }, (_, i) => {
  const angle = (i / 6) * Math.PI * 2
  return {
    id: i,
    dx: `${Math.round(Math.cos(angle) * 54)}px`,
    dy: `${Math.round(Math.sin(angle) * 54)}px`,
  }
})

// strip nikud so sizing depends on the base letters only
const baseLen = (s) => String(s).replace(/[֑-ׇ]/g, '').length

// a plain color swatch — always ringed, so white still reads on the white tile
export function ColorSwatch({ hex, size = 96, className = '' }) {
  return (
    <span
      className={`rounded-2xl border-4 border-slate-400 shadow-inner block ${className}`}
      style={{ width: size, height: size, backgroundColor: hex }}
      aria-label={hex}
    />
  )
}

function TileContent({ tile }) {
  if (tile.kind === 'shape') return <ShapeSvg name={tile.value} size={96} className="md:w-28 md:h-28 drop-shadow-md" />
  if (tile.kind === 'color') return <ColorSwatch hex={tile.value} className="md:w-28 md:h-28" />
  if (tile.kind === 'emoji') return <span className="text-6xl md:text-7xl leading-none">{tile.value}</span>
  const n = baseLen(tile.value)
  const size = n <= 1 ? 'text-7xl md:text-8xl short:text-4xl' : n <= 3 ? 'text-5xl md:text-6xl short:text-3xl' : 'text-4xl md:text-5xl short:text-3xl'
  return (
    <span className={`${size} font-black leading-normal`} dir="rtl">
      {tile.value}
    </span>
  )
}

/**
 * 2×2 grid of huge tiles: letters, words, pictures or shapes.
 * Right tap: tile jumps gold with a star burst. Wrong tap: that tile shakes
 * red while the correct one wobbles green so the answer is learned.
 */
export default function BigTiles({ question, disabled, onAnswer }) {
  const [tapped, setTapped] = useState(null)
  const [reveal, setReveal] = useState(false)
  const lockRef = useRef(false)

  const tap = (tile) => {
    if (disabled || lockRef.current) return
    lockRef.current = true
    setTapped(tile.id)
    if (tile.correct) {
      sfx.click()
      onAnswer(true, 600)
    } else {
      setReveal(true)
      onAnswer(false, 900)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-5 w-full max-w-lg mx-auto" dir="rtl">
      {question.tiles.map((tile) => {
        const hitCorrect = tapped === tile.id && tile.correct
        const hitWrong = tapped === tile.id && !tile.correct
        const showCorrect = reveal && tile.correct
        return (
          <div key={tile.id} className="relative">
            <button
              onClick={() => tap(tile)}
              disabled={disabled || tapped !== null}
              className={`w-full min-h-32 md:min-h-40 short:min-h-16 rounded-3xl border-b-8 flex items-center justify-center p-3 short:p-1.5 transition-all shadow-lg select-none
                ${hitCorrect
                  ? 'bg-yellow-300 border-yellow-500 text-yellow-900 anim-wave-jump'
                  : hitWrong
                    ? 'bg-red-400 border-red-600 text-white anim-shake'
                    : showCorrect
                      ? 'bg-green-300 border-green-500 text-green-900 anim-wobble'
                      : 'bg-white text-slate-800 border-slate-300 active:border-b-0 active:translate-y-2'}`}
            >
              <TileContent tile={tile} />
            </button>
            {hitCorrect && (
              <span className="absolute inset-0 pointer-events-none z-10">
                {STARS.map((s) => (
                  <span
                    key={s.id}
                    className="anim-star-burst absolute left-1/2 top-1/2 -ml-3 -mt-3 text-pink-500 text-3xl leading-none"
                    style={{ '--dx': s.dx, '--dy': s.dy }}
                  >
                    ★
                  </span>
                ))}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
