import { useEffect, useRef } from 'react'
import { Award, Flag, Zap, Star, Coins, Lock } from 'lucide-react'
import shopItems from '../data/shop.json'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useToast } from '../App.jsx'
import { speak } from '../match/speak.js'

const ICONS = { award: Award, flag: Flag, zap: Zap, star: Star }
const ICON_COLORS = { award: 'text-blue-500', flag: 'text-purple-500', zap: 'text-yellow-500 fill-current', star: 'text-cyan-500 fill-current' }
// English rarity tags stay (game words), Hebrew word underneath carries the meaning
const RARITY_HE = { RARE: 'נדיר', EPIC: 'אפי', LEGENDARY: 'אגדי' }

export default function Shop() {
  const { state, dispatch } = usePlayer()
  const showToast = useToast()
  const lastBuyRef = useRef(0) // double-tap protection

  useEffect(() => {
    speak('החנות של הפרסים', { delay: 300 })
  }, [])

  const handleBuy = (item) => {
    const now = Date.now()
    if (now - lastBuyRef.current < 800) return
    lastBuyRef.current = now

    if (state.coins >= item.cost) {
      dispatch({ type: 'BUY', item })
      showToast(`${item.title} שלך! 🎉`, 'success')
    } else {
      showToast(`חסרים ${(item.cost - state.coins).toLocaleString('he-IL')} מטבעות`, 'error')
    }
  }

  return (
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <div className="flex justify-between items-center gap-3 bg-(--t-panel) p-3 lg:p-4 rounded-2xl border-4 border-(--t-panel-border) backdrop-blur-sm">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white drop-shadow-md">פרסים אמיתיים 🎁</h2>
          <p className="text-(--t-text-soft) font-bold text-sm lg:text-base mt-0.5 lg:mt-1 leading-snug">
            מטבעות קונים פרסים אמיתיים — אמא ואבא מביאים!
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-2 bg-black/20 px-4 py-2 rounded-xl shrink-0">
          <span className="text-(--t-text-soft) font-bold text-sm">המטבעות שלך:</span>
          <span className="text-yellow-400 font-black text-xl tabular-nums">{state.coins.toLocaleString('he-IL')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        {shopItems.map((item) => {
          const Icon = ICONS[item.icon] ?? Award
          const canAfford = state.coins >= item.cost
          return (
            <div key={item.id} className="relative bg-white rounded-3xl border-4 lg:border-8 border-slate-200 overflow-hidden shadow-xl flex flex-col group">
              {!canAfford && (
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-[1.25rem]">
                  <div className="bg-red-500 px-4 py-2 rounded-xl border-b-4 border-red-700 -rotate-12 flex items-center gap-2 shadow-xl">
                    <Lock className="text-white" size={20} strokeWidth={3} />
                    <span className="font-black text-white text-lg">נעול</span>
                  </div>
                </div>
              )}

              {/* rarity strip: one line on phones, stacked on the tall card */}
              <div className={`${item.bgColor} px-2 py-1 lg:p-2 text-center border-b-4 border-black/10 flex flex-row lg:flex-col items-center justify-center leading-none gap-1.5 lg:gap-0.5`}>
                <span className="text-white font-black uppercase text-sm tracking-widest drop-shadow-md">{item.rarity}</span>
                <span className="text-white/90 font-bold text-xs drop-shadow-md">{RARITY_HE[item.rarity] ?? ''}</span>
              </div>

              {/* phone: icon · text · price all on one row (the wrapper is
                  dissolved by lg:contents, restoring the tall stacked card) */}
              <div className="flex flex-row items-stretch flex-1 lg:contents">
              <div className="p-3 lg:p-6 flex flex-row lg:flex-col items-center text-start lg:text-center flex-1 min-w-0 relative gap-3 lg:gap-0 bg-gradient-to-b from-slate-50 to-slate-200">
                <div className="hidden lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white rounded-full blur-2xl opacity-60"></div>
                <div className="relative z-10 shrink-0 w-16 h-16 lg:w-24 lg:h-24 bg-white rounded-2xl border-4 border-slate-200 flex items-center justify-center lg:mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Icon className={`${ICON_COLORS[item.icon]} w-10 h-10 lg:w-16 lg:h-16`} />
                </div>
                <div className="flex-1 min-w-0 lg:contents">
                  <span className="block text-xs font-bold text-slate-400 lg:mb-1">{item.type}</span>
                  <h3 className="text-xl lg:text-2xl font-black text-slate-800 leading-tight lg:mb-3">{item.title}</h3>
                  <p className="text-slate-600 font-semibold text-sm leading-snug">{item.desc}</p>
                </div>
              </div>

              <div className="shrink-0 flex items-center p-2.5 lg:p-4 bg-slate-100 border-s-4 lg:border-s-0 lg:border-t-4 border-slate-200 lg:mt-auto">
                <button
                  onClick={() => handleBuy(item)}
                  disabled={!canAfford}
                  aria-label={`לקנות ${item.title} ב-${item.cost} מטבעות`}
                  className={`w-full min-h-14 px-3 flex items-center justify-center gap-2 py-2.5 lg:py-3 rounded-xl font-black text-xl tabular-nums transition-all
                    ${canAfford
                      ? 'bg-yellow-400 text-yellow-950 border-b-4 border-yellow-600 hover:bg-yellow-300 active:border-b-0 active:translate-y-1 shadow-md'
                      : 'bg-slate-300 text-slate-500 border-b-4 border-slate-400 cursor-not-allowed'}`}
                >
                  <Coins className={canAfford ? 'fill-yellow-200 shrink-0' : 'fill-slate-400 shrink-0'} size={24} />
                  {item.cost.toLocaleString('he-IL')}
                </button>
              </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
