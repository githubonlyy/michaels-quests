import NumberPad from './NumberPad.jsx'

// chunk n items into rows of 5 so she can count by fives
const rowsOf = (n, per = 5) => {
  const rows = []
  for (let i = 0; i < n; i += per) rows.push(Math.min(per, n - i))
  return rows
}

/**
 * A tidy pile of emojis: rows of five, big enough to count by finger.
 * Shared by the counting widget, the balloon prompt and the compare panels.
 */
export function EmojiGrid({ emoji, n, size = 'lg' }) {
  const cell = size === 'lg' ? 'text-4xl md:text-5xl short:text-2xl w-11 h-11 md:w-14 md:h-14 short:w-7 short:h-7' : 'text-3xl md:text-4xl short:text-xl w-9 h-9 md:w-11 md:h-11 short:w-6 short:h-6'
  return (
    <div className="flex flex-col items-center gap-1 md:gap-1.5" dir="ltr" aria-label={`${n} ${emoji}`}>
      {rowsOf(n).map((count, r) => (
        <div key={r} className={`flex gap-0.5 md:gap-1 rounded-xl px-1 ${r % 2 ? 'bg-black/5' : ''}`}>
          {Array.from({ length: count }).map((_, i) => (
            <span key={i} className={`${cell} flex items-center justify-center leading-none select-none`}>
              {emoji}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

// Counting: the objects on top, a two-digit number pad below.
export default function CountObjects({ question, disabled, onAnswer }) {
  return (
    <div className="flex flex-col items-center gap-4 md:gap-6 w-full">
      <div className="bg-sky-50 border-4 border-sky-200 rounded-3xl px-4 py-3 md:px-6 md:py-4 shadow-inner">
        <EmojiGrid emoji={question.emoji} n={question.n} />
      </div>
      <NumberPad question={{ a: String(question.n) }} disabled={disabled} onAnswer={onAnswer} maxDigits={2} />
    </div>
  )
}
