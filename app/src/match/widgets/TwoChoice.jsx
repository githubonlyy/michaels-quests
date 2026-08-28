import { useRef, useState } from 'react'
import { sfx } from '../sounds.js'
import { EmojiGrid } from './CountObjects.jsx'

/**
 * "Which has more?" — two huge side-by-side panels, tap one.
 * Panels are laid out LTR so `left`/`right` mean what the spoken answer says.
 * Count panels show emoji piles, number panels show a giant numeral.
 */
export default function TwoChoice({ question, disabled, onAnswer }) {
  const [tapped, setTapped] = useState(null)
  const [reveal, setReveal] = useState(false)
  const lockRef = useRef(false)

  const tap = (panel) => {
    if (disabled || lockRef.current) return
    lockRef.current = true
    setTapped(panel.id)
    if (panel.correct) {
      sfx.click()
      onAnswer(true, 600)
    } else {
      setReveal(true)
      onAnswer(false, 900)
    }
  }

  return (
    <div className="flex gap-3 md:gap-6 w-full max-w-2xl mx-auto" dir="ltr">
      {question.panels.map((panel) => {
        const hitCorrect = tapped === panel.id && panel.correct
        const hitWrong = tapped === panel.id && !panel.correct
        const showCorrect = reveal && panel.correct
        return (
          <button
            key={panel.id}
            onClick={() => tap(panel)}
            disabled={disabled || tapped !== null}
            className={`flex-1 min-w-[45%] min-h-56 md:min-h-72 short:min-h-32 rounded-3xl border-b-8 flex items-center justify-center p-3 md:p-5 short:p-2 transition-all shadow-lg select-none
              ${hitCorrect
                ? 'bg-yellow-300 border-yellow-500 anim-wave-jump'
                : hitWrong
                  ? 'bg-red-400 border-red-600 anim-shake'
                  : showCorrect
                    ? 'bg-green-300 border-green-500 anim-wobble'
                    : panel.id === 'left'
                      ? 'bg-pink-50 border-pink-300 active:border-b-0 active:translate-y-2'
                      : 'bg-violet-50 border-violet-300 active:border-b-0 active:translate-y-2'}`}
          >
            {panel.kind === 'count' ? (
              <EmojiGrid emoji={panel.emoji} n={panel.n} size="md" />
            ) : (
              <span className="text-8xl md:text-9xl font-black text-slate-800 tabular-nums leading-none">{panel.value}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
