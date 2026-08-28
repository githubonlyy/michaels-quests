import { useEffect, useState } from 'react'
import { Coins, Sparkles, Heart } from 'lucide-react'
import { sfx } from './sounds.js'

const BURST = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2
  const dist = 70 + (i % 3) * 30
  return {
    id: i,
    dx: `${Math.round(Math.cos(angle) * dist)}px`,
    dy: `${Math.round(Math.sin(angle) * dist * 0.8 - 40)}px`,
    delay: (i % 5) * 0.06,
  }
})

const SPARKLES = [
  { id: 0, cls: '-top-3 -left-3', dx: '-14px', dy: '-18px', delay: 0 },
  { id: 1, cls: '-top-4 right-4', dx: '12px', dy: '-20px', delay: 0.15 },
  { id: 2, cls: 'top-6 -right-4', dx: '18px', dy: '-6px', delay: 0.3 },
  { id: 3, cls: 'top-8 -left-5', dx: '-18px', dy: '4px', delay: 0.45 },
]

/**
 * End-of-match treasure box: the heart clasp jiggles, the lid pops open,
 * coins burst out and the earned total counts up. LOSS thuds first and only
 * creaks open. Practice mode opens to a blue XP glow instead of gold coins.
 */
export default function VaultReveal({ coins, xp, result, practice, onDone }) {
  // spin -> (thud on LOSS) -> open -> count -> done
  const [stage, setStage] = useState('spin')
  const [count, setCount] = useState(0)

  const total = practice ? xp : coins
  const isLoss = result === 'LOSS'
  const opened = stage === 'open' || stage === 'count' || stage === 'done'

  useEffect(() => {
    const t1 = setTimeout(() => setStage(isLoss ? 'thud' : 'open'), 950)
    const t2 = isLoss ? setTimeout(() => setStage('open'), 1750) : null
    return () => { clearTimeout(t1); if (t2) clearTimeout(t2) }
  }, [isLoss])

  useEffect(() => {
    if (stage === 'thud') sfx.thud()
    if (stage !== 'open') return
    sfx.click()
    const t = setTimeout(() => setStage('count'), 450)
    return () => clearTimeout(t)
  }, [stage])

  // count-up ticker
  useEffect(() => {
    if (stage !== 'count') return
    if (total === 0) { setStage('done'); return }
    const step = Math.max(1, Math.ceil(total / 40))
    let tick = 0
    const iv = setInterval(() => {
      if (tick++ % 5 === 0) sfx.coin()
      setCount((c) => {
        const next = c + step
        if (next >= total) { clearInterval(iv); setStage('done'); return total }
        return next
      })
    }, 28)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  useEffect(() => {
    if (stage === 'done' && onDone) onDone()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  const glowColor = practice ? 'from-blue-300 via-sky-200 to-blue-500' : 'from-yellow-200 via-amber-300 to-pink-300'

  return (
    <div className="flex flex-col items-center">
      <div className={`relative w-44 h-40 md:w-48 md:h-44 ${stage === 'thud' ? 'anim-vault-thud' : ''}`}>
        {/* interior glow + treasure (peeks out when the lid opens) */}
        {opened && (
          <div className={`absolute left-3 right-3 top-9 bottom-2 rounded-2xl bg-gradient-to-t ${glowColor} anim-vault-glow flex items-start justify-center pt-1 overflow-hidden`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.75),transparent_65%)]"></div>
            {practice ? (
              <Sparkles className="w-12 h-12 text-white drop-shadow-lg relative z-10" />
            ) : (
              <div className="relative z-10 flex items-center gap-1 text-3xl leading-none">
                <span>💎</span>
                <Coins className="w-11 h-11 text-amber-900 fill-yellow-300 drop-shadow-lg" />
                <span>💖</span>
              </div>
            )}
          </div>
        )}

        {/* coin burst */}
        {(stage === 'count' || stage === 'done') && total > 0 && (
          <div className="absolute inset-0 pointer-events-none z-30">
            {BURST.map((p) => (
              <div
                key={p.id}
                className="anim-coin-burst absolute left-1/2 top-1/3 w-4 h-4 -ml-2 -mt-2 rounded-full border-2 shadow"
                style={{
                  '--dx': p.dx,
                  '--dy': p.dy,
                  animationDelay: `${p.delay}s`,
                  background: practice ? '#93c5fd' : '#facc15',
                  borderColor: practice ? '#1d4ed8' : '#a16207',
                }}
              ></div>
            ))}
          </div>
        )}

        {/* box body */}
        <div className="absolute left-0 right-0 bottom-0 h-24 rounded-b-3xl rounded-t-md bg-gradient-to-b from-pink-400 via-pink-500 to-fuchsia-700 border-4 border-fuchsia-900 z-10 shadow-xl">
          {/* gold band */}
          <div className="absolute inset-x-0 top-5 h-2.5 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 border-y-2 border-amber-600/60"></div>
          {/* star bolts */}
          {['bottom-2 left-2', 'bottom-2 right-2', 'top-9 left-2', 'top-9 right-2'].map((pos) => (
            <span key={pos} className={`absolute ${pos} text-yellow-300 text-sm leading-none drop-shadow`}>★</span>
          ))}
          {/* heart clasp = the lock; it jiggles while "unlocking" */}
          <div
            className={`absolute left-1/2 -ml-6 top-0 -mt-3 w-12 h-12 rounded-full bg-gradient-to-br from-yellow-200 to-amber-400 border-4 border-amber-600 shadow-md flex items-center justify-center ${stage === 'spin' ? 'anim-dial-spin' : ''}`}
          >
            <Heart className="w-6 h-6 text-pink-600 fill-pink-500" />
          </div>
        </div>

        {/* lid — hinged on the left, pops open */}
        <div className={`absolute left-0 right-0 top-5 h-14 rounded-t-3xl bg-gradient-to-b from-pink-300 via-pink-400 to-pink-500 border-4 border-fuchsia-900 z-20 shadow-lg ${opened ? 'anim-chest-lid' : ''}`}>
          <div className="absolute inset-x-3 top-2 h-2 rounded-full bg-white/50"></div>
          <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400"></div>
          <span className="absolute top-1 right-3 text-white/80 text-lg leading-none">✦</span>
        </div>

        {/* sparkles once open */}
        {opened && (
          <div className="absolute inset-0 pointer-events-none z-30">
            {SPARKLES.map((s) => (
              <span
                key={s.id}
                className={`anim-star-burst absolute ${s.cls} text-yellow-300 text-3xl leading-none`}
                style={{ '--dx': s.dx, '--dy': s.dy, animationDelay: `${s.delay}s` }}
              >
                ✨
              </span>
            ))}
          </div>
        )}
      </div>

      {/* counter */}
      <div className="mt-3 flex items-center gap-2 min-h-12">
        {stage === 'done' || stage === 'count' ? (
          <div className={`flex items-center gap-2 px-5 py-1.5 rounded-2xl border-4 anim-pop ${
            practice ? 'bg-blue-100 border-blue-300' : 'bg-yellow-100 border-yellow-400'
          }`}>
            {practice ? (
              <Sparkles className="text-blue-500" size={24} />
            ) : (
              <Coins className="text-yellow-600 fill-yellow-300" size={24} />
            )}
            <span className={`text-3xl font-black tabular-nums ${practice ? 'text-blue-600' : 'text-yellow-700'}`}>
              {count}
            </span>
            <span className={`text-sm font-black ${practice ? 'text-blue-400' : 'text-yellow-600'}`}>
              {practice ? 'XP' : 'מטבעות'}
            </span>
          </div>
        ) : (
          <span className="text-sm font-black text-slate-400 tracking-wide" dir="rtl">
            {isLoss && stage === 'thud' ? 'הקופסה תקועה…' : 'פותחים את הקופסה…'}
          </span>
        )}
      </div>
    </div>
  )
}
