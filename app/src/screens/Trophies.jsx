import { useEffect } from 'react'
import {
  Trophy, Target, Flame, Crown, CaseSensitive, Palette, Hash, Puzzle,
  Shapes, Scale, Coins, Shirt, ShoppingBag, Gift, Lock,
  Truck, Volume2, ListOrdered, ArrowLeftRight,
} from 'lucide-react'
import { TROPHIES } from '../data/trophies.js'
import { usePlayer } from '../context/PlayerContext.jsx'
import { speak } from '../match/speak.js'

// every `icon` key used in data/trophies.js → lucide component (Trophy = fallback)
const ICONS = {
  trophy: Trophy,
  target: Target,
  flame: Flame,
  crown: Crown,
  letters: CaseSensitive,
  palette: Palette,
  hash: Hash,
  puzzle: Puzzle,
  shapes: Shapes,
  scale: Scale,
  coins: Coins,
  shirt: Shirt,
  bag: ShoppingBag,
  gift: Gift,
  truck: Truck,
  sound: Volume2,
  digits: ListOrdered,
  swap: ArrowLeftRight,
}

export default function Trophies() {
  const { state } = usePlayer()
  const earnedCount = Object.keys(state.trophies).length

  useEffect(() => {
    speak('הגביעים שלי', { delay: 300 })
  }, [])

  return (
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <div className="flex justify-between items-center gap-2 bg-(--t-panel) p-3 lg:p-4 rounded-2xl border-4 border-(--t-panel-border) backdrop-blur-sm">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white drop-shadow-md whitespace-nowrap">הגביעים שלי 🏆</h2>
        <div className="shrink-0 px-3 py-1.5 bg-yellow-400 text-yellow-900 rounded-xl border-b-4 border-yellow-600 font-black text-sm tabular-nums" dir="ltr">
          {earnedCount}/{TROPHIES.length}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {TROPHIES.map((t) => {
          const earnedTs = state.trophies[t.id]
          const Icon = ICONS[t.icon] ?? Trophy
          return (
            <div
              key={t.id}
              className={`rounded-3xl border-4 p-2.5 sm:p-4 flex flex-col items-center text-center gap-1.5 sm:gap-2 shadow-lg transition-transform
                ${earnedTs
                  ? 'bg-white border-yellow-400 hover:scale-105'
                  : 'bg-(--t-panel) border-(--t-panel-border) backdrop-blur-sm'}`}
            >
              <div
                className={`w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-2xl border-4 flex items-center justify-center rotate-3 relative
                  ${earnedTs
                    ? 'bg-gradient-to-br from-yellow-300 to-amber-500 border-yellow-600 shadow-md'
                    : 'bg-(--t-side-deep) border-(--t-panel-border)'}`}
              >
                <Icon className={earnedTs ? 'text-yellow-900 w-7 h-7 sm:w-8 sm:h-8' : 'text-(--t-text-soft) opacity-70 w-7 h-7 sm:w-8 sm:h-8'} />
                {!earnedTs && (
                  <span className="absolute -bottom-2 -end-2 bg-slate-700 rounded-full p-1 border-2 border-slate-900">
                    <Lock size={12} className="text-slate-300" />
                  </span>
                )}
              </div>
              <span className={`font-black leading-tight ${earnedTs ? 'text-slate-800' : 'text-white/90'}`}>
                {t.title}
              </span>
              <span className={`text-xs font-bold leading-snug ${earnedTs ? 'text-slate-500' : 'text-(--t-text-soft)'}`}>
                {t.he}
              </span>
              {earnedTs && (
                <span className="text-[10px] font-black text-yellow-600 tracking-wider">
                  {new Date(earnedTs).toLocaleDateString('he-IL')}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
