import { useState } from 'react'
import { Delete, Check } from 'lucide-react'
import { sfx } from '../sounds.js'

/**
 * Visual strip for a math exercise: `dots: [a, b]`.
 * Addition (b >= 0): two colored groups side by side.
 * Subtraction (b < 0): `a` dots with the last |b| crossed out.
 */
export function DotsStrip({ dots }) {
  if (!dots || dots.length < 2) return null
  const [a, b] = dots
  const group = (count, cls, crossFrom = Infinity) => (
    <div
      className="grid gap-1 md:gap-1.5"
      style={{ gridTemplateColumns: `repeat(${Math.min(10, Math.max(1, count))}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const crossed = i >= crossFrom
        return (
          <span
            key={i}
            className={`relative w-6 h-6 md:w-8 md:h-8 rounded-full border-2 ${cls} ${crossed ? 'opacity-40' : ''}`}
          >
            {crossed && (
              <span className="absolute inset-0 flex items-center justify-center text-red-600 font-black text-xl md:text-2xl leading-none opacity-100">
                ✕
              </span>
            )}
          </span>
        )
      })}
    </div>
  )

  return (
    <div className="flex items-center justify-center gap-3 md:gap-4 short:gap-1.5 flex-wrap bg-slate-50 border-4 border-slate-200 rounded-2xl px-4 py-3 short:px-2 short:py-1.5" dir="ltr">
      {b >= 0 ? (
        <>
          {group(a, 'bg-pink-400 border-pink-600')}
          <span className="text-3xl font-black text-slate-500">+</span>
          {group(b, 'bg-sky-400 border-sky-600')}
        </>
      ) : (
        group(a, 'bg-pink-400 border-pink-600', a + b)
      )}
    </div>
  )
}

// Number answer input: builds a digit string (capped at maxDigits), OK submits.
export default function NumberPad({ question, disabled, onAnswer, maxDigits = 2 }) {
  const [value, setValue] = useState('')
  const [result, setResult] = useState(null) // 'ok' | 'bad' once submitted

  const press = (d) => {
    if (disabled || result || value.length >= maxDigits) return
    sfx.click()
    setValue(value + d)
  }
  const backspace = () => {
    if (disabled || result) return
    sfx.click()
    setValue(value.slice(0, -1))
  }
  const submit = () => {
    if (disabled || result || value === '') return
    const ok = String(Number(value)) === String(question.a)
    setResult(ok ? 'ok' : 'bad')
    onAnswer(ok, ok ? 400 : 700)
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  const keyCls = 'min-h-18 md:min-h-20 short:min-h-11 rounded-2xl border-b-8 text-4xl short:text-2xl font-black transition-all shadow active:border-b-0 active:translate-y-2 disabled:opacity-50 flex items-center justify-center'

  return (
    <div className="flex flex-col items-center gap-3 md:gap-4 short:gap-1.5 w-full max-w-sm short:max-w-xs mx-auto">
      <div
        className={`w-full font-black text-5xl md:text-6xl short:text-3xl text-center py-2 short:py-0 rounded-2xl border-4 shadow-inner min-h-20 short:min-h-12 flex items-center justify-center tracking-widest tabular-nums transition-colors
          ${result === 'ok'
            ? 'bg-green-100 border-green-400 text-green-700'
            : result === 'bad'
              ? 'bg-red-100 border-red-400 text-red-600 anim-shake'
              : 'bg-slate-900 border-slate-700 text-yellow-400'}`}
        dir="ltr"
      >
        {value || <span className="text-slate-500">?</span>}
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3 short:gap-1.5 w-full" dir="ltr">
        {keys.map((k) => (
          <button key={k} onClick={() => press(k)} disabled={disabled || !!result} className={`${keyCls} bg-white text-slate-800 border-slate-300`}>
            {k}
          </button>
        ))}
        <button
          onClick={backspace}
          disabled={disabled || !!result}
          className={`${keyCls} bg-rose-400 text-white border-rose-600`}
          aria-label="מחיקה"
        >
          <Delete size={32} />
        </button>
        <button onClick={() => press('0')} disabled={disabled || !!result} className={`${keyCls} bg-white text-slate-800 border-slate-300`}>
          0
        </button>
        <button
          onClick={submit}
          disabled={disabled || !!result || value === ''}
          className={`${keyCls} bg-green-500 text-white border-green-700`}
          aria-label="אישור"
        >
          <Check size={34} strokeWidth={3.5} />
        </button>
      </div>
    </div>
  )
}
