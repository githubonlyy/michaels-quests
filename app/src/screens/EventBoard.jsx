import { useEffect, useState } from 'react'
import { Coins, Check, X, Sparkles, Gift } from 'lucide-react'
import { EVENTS, MODES } from '../data/events.js'
import { usePlayer, businessDate } from '../context/PlayerContext.jsx'
import { sfx } from '../match/sounds.js'
import { speak } from '../match/speak.js'

export default function EventBoard({ onStartMatch }) {
  const { state, playedToday, config } = usePlayer()
  const [preview, setPreview] = useState(null) // event shown in the pre-match modal
  const [chestOpen, setChestOpen] = useState(false)

  const goal = config.dailyGoal
  const doneCount = EVENTS.filter((e) => playedToday(e.id)).length
  const goalDone = Math.min(doneCount, goal)
  const chestReady = doneCount >= goal
  const chestClaimed = state.chestClaimed === businessDate()
  // 8 questions × 10 coins + win bonus
  const maxCoins = config.questionsPerMatch * config.coinsPerCorrect + config.winBonusCoins

  const openPreview = (event) => {
    sfx.click()
    setPreview(event)
  }

  return (
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <div className="flex justify-between items-center gap-2 bg-(--t-panel) p-3 lg:p-4 rounded-2xl border-4 border-(--t-panel-border) backdrop-blur-sm">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-wide drop-shadow-md whitespace-nowrap">המשימות של היום</h2>
        {/* phone: badge drops to "חדשות" only, so the title never wraps at 360px */}
        <div className="shrink-0 px-2 py-1 sm:px-3 sm:py-1.5 bg-green-500 text-white rounded-xl border-b-4 border-green-700 font-bold text-xs sm:text-sm flex items-center gap-1">
          <Check size={14} strokeWidth={3} className="shrink-0" />
          <span className="whitespace-nowrap"><span className="hidden sm:inline">משימות </span>חדשות</span>
        </div>
      </div>

      {/* DAILY CHEST STRIP */}
      <div className="flex items-center gap-2.5 sm:gap-3 bg-(--t-panel) p-2.5 sm:p-3 lg:p-4 rounded-2xl border-4 border-(--t-panel-border) backdrop-blur-sm">
        <button
          onClick={() => chestReady && !chestClaimed && setChestOpen(true)}
          disabled={!chestReady || chestClaimed}
          className={`shrink-0 w-14 h-14 sm:w-16 sm:h-16 lg:w-18 lg:h-18 rounded-2xl border-b-4 flex items-center justify-center transition-all
            ${chestClaimed
              ? 'bg-green-500 border-green-700'
              : chestReady
                ? 'bg-yellow-400 border-yellow-600 anim-ready-pulse cursor-pointer shadow-[0_0_18px_rgba(250,204,21,0.7)]'
                : 'bg-black/30 border-(--t-side-deep)'}`}
          aria-label="תיבת האוצר היומית"
        >
          {chestClaimed
            ? <Check size={30} strokeWidth={3.5} className="text-white" />
            : <Gift size={30} className={chestReady ? 'text-yellow-900' : 'text-(--t-text-soft)'} />}
        </button>
        <div className="flex-1" dir="rtl">
          <p className="text-white font-black leading-tight text-sm sm:text-base">
            {chestClaimed
              ? 'תיבת האוצר נאספה! נתראה מחר'
              : chestReady
                ? 'תיבת האוצר מוכנה — פתחו אותה!'
                : `שחקו ${goal} משימות שונות היום — ${goalDone}/${goal}`}
          </p>
          <div className="flex gap-1.5 mt-1.5">
            {Array.from({ length: goal }).map((_, i) => (
              <span
                key={i}
                className={`h-2.5 flex-1 max-w-16 rounded-full ${i < goalDone ? 'bg-yellow-400' : 'bg-black/30'}`}
              ></span>
            ))}
          </div>
        </div>
      </div>

      {chestOpen && <ChestModal onClose={() => setChestOpen(false)} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-8">
        {EVENTS.map((event) => {
          const practice = playedToday(event.id)
          return (
            <div
              key={event.id}
              onClick={() => openPreview(event)}
              className={`group relative ${event.color} rounded-3xl border-b-8 ${event.borderColor} cursor-pointer hover:-translate-y-2 active:translate-y-2 active:border-b-0 transition-all duration-200 shadow-xl`}
            >
              <div className="bg-white m-1.5 rounded-[1.25rem] h-[calc(100%-12px)] flex flex-col overflow-hidden relative">
                {/* subject strip: the emoji + card colour already carry it on phones */}
                <div className={`${event.headerColor} hidden sm:block p-2 text-center border-b-4 border-black/10`}>
                  <span className="text-white font-black text-sm tracking-wider drop-shadow-sm">
                    {event.type}
                  </span>
                </div>

                <div className="p-3 sm:p-4 lg:p-6 sm:pb-12 lg:pb-14 flex items-center sm:items-start gap-3 lg:gap-4 flex-1">
                  <div className={`w-16 h-16 sm:w-18 sm:h-18 lg:w-22 lg:h-22 shrink-0 rounded-2xl bg-slate-100 border-4 ${event.borderColor} shadow-inner rotate-3 group-hover:rotate-0 transition-transform flex items-center justify-center text-4xl sm:text-5xl lg:text-6xl leading-none`}>
                    {event.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 sm:mb-2">
                      <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-800 leading-tight">
                        {event.title}
                      </h3>
                      {/* phone: the reward pill rides the title line instead of a footer row */}
                      <RewardBadge practice={practice} maxCoins={maxCoins} className="sm:hidden shrink-0 ms-auto" />
                    </div>
                    <div className="bg-slate-100 p-1.5 sm:p-2 rounded-xl border-2 border-slate-200">
                      <p className="font-bold text-slate-600 text-sm lg:text-base leading-snug">{event.description}</p>
                    </div>
                  </div>
                </div>

                <RewardBadge practice={practice} maxCoins={maxCoins} className="hidden sm:flex absolute bottom-4 end-4" />
              </div>
            </div>
          )
        })}
      </div>

      {preview && (
        <PreviewModal
          event={preview}
          practice={playedToday(preview.id)}
          onClose={() => setPreview(null)}
          onStart={(mode) => { setPreview(null); onStartMatch(preview, mode) }}
        />
      )}
    </div>
  )
}

/* ---------- REWARD PILL ---------- */

// "up to N coins" / "practice" pill. Rides the title line on phones and sits in
// the card's bottom corner from sm: up, so the markup only exists once.
function RewardBadge({ practice, maxCoins, className = '' }) {
  return practice ? (
    <div className={`bg-blue-100 px-2.5 py-1 rounded-full border-2 border-blue-300 flex items-center gap-1 shadow-md ${className}`}>
      <Sparkles className="text-blue-600 shrink-0" size={14} />
      <span className="font-black text-blue-600 text-xs sm:text-sm whitespace-nowrap">אימון · XP</span>
    </div>
  ) : (
    <div className={`bg-yellow-400 px-2.5 py-1 rounded-full border-2 border-yellow-600 flex items-center gap-1 shadow-md ${className}`}>
      <Coins className="text-yellow-900 fill-current shrink-0" size={14} />
      <span className="font-black text-yellow-900 text-xs sm:text-sm whitespace-nowrap">עד {maxCoins}+</span>
    </div>
  )
}

/* ---------- PRE-MATCH MODAL ---------- */

const MODE_STYLES = {
  balloon: 'bg-orange-400 hover:bg-orange-300 border-orange-600',
  pairs: 'bg-indigo-500 hover:bg-indigo-400 border-indigo-700',
}

function PreviewModal({ event, practice, onClose, onStart }) {
  // she can't read the description — say it
  useEffect(() => {
    speak(`${event.title}. ${event.description}`, { delay: 200 })
  }, [event])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--t-overlay) backdrop-blur-sm p-4">
      <div className="anim-zoom-in bg-white rounded-3xl border-8 border-(--t-side-deep) shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-xl max-h-full overflow-y-auto flex flex-col relative">
        <div className={`p-[min(1.5rem,4.5vh)] text-center relative border-b-8 border-black/10 ${event.headerColor}`}>
          <button
            onClick={onClose}
            aria-label="סגירה"
            className="absolute top-4 left-4 w-12 h-12 bg-black/20 hover:bg-black/30 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <X size={24} strokeWidth={3} />
          </button>
          <div className="w-[min(6rem,18vh)] h-[min(6rem,18vh)] mx-auto bg-white rounded-2xl border-4 border-slate-200 flex items-center justify-center mb-2 shadow-lg rotate-3 text-[min(3.75rem,11vh)] leading-none">
            {event.emoji}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide drop-shadow-md mt-2">
            {event.title}
          </h2>
        </div>

        <div className="p-[min(1.25rem,4vh)] lg:p-8 flex flex-col items-center text-center bg-slate-50">
          <div className="inline-block px-4 py-1 bg-slate-200 rounded-full font-bold text-slate-500 tracking-wider text-sm mb-4">
            {event.type}
          </div>
          <div className="flex items-center gap-3 mb-[min(1.5rem,4vh)] max-w-md">
            <button
              onClick={() => speak(event.description)}
              aria-label="להשמיע שוב"
              className="w-12 h-12 shrink-0 rounded-full bg-(--t-accent-deep) border-b-4 border-(--t-side) text-2xl flex items-center justify-center active:border-b-0 active:translate-y-1 transition-all"
            >
              🔊
            </button>
            <p className="text-lg font-bold text-slate-700 leading-relaxed">{event.description}</p>
          </div>

          {practice && (
            <div className="bg-blue-50 border-4 border-blue-200 rounded-2xl px-4 py-3 mb-6 w-full">
              <p className="font-bold text-blue-700 text-sm">
                כבר שיחקת היום! משחק חוזר = אימון: נקודות XP בלבד, בלי מטבעות.
              </p>
            </div>
          )}

          {/* game mode picker */}
          <div className="w-full space-y-3">
            <button
              onClick={() => onStart('classic')}
              className="w-full bg-green-500 hover:bg-green-400 text-white text-2xl font-black py-4 rounded-2xl border-b-8 border-green-700 active:border-b-0 active:translate-y-2 transition-all shadow-lg"
            >
              יאללה, משחקים! {event.emoji}
            </button>
            {event.modes.filter((m) => m !== 'classic').map((m) => (
              <button
                key={m}
                onClick={() => onStart(m)}
                className={`w-full ${MODE_STYLES[m] ?? 'bg-slate-500 border-slate-700'} text-white font-black py-3 rounded-2xl border-b-8 active:border-b-0 active:translate-y-2 transition-all shadow-lg flex flex-col items-center leading-tight`}
              >
                <span className="text-xl">{m === 'balloon' ? '🎈' : '🃏'} {MODES[m].label}</span>
                <span className="text-xs font-bold opacity-90">{MODES[m].heLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- DAILY CHEST MODAL ---------- */

const CHEST_BURST = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2
  const dist = 60 + (i % 3) * 26
  return {
    id: i,
    dx: `${Math.round(Math.cos(angle) * dist)}px`,
    dy: `${Math.round(Math.sin(angle) * dist * 0.7 - 46)}px`,
    delay: (i % 4) * 0.07,
  }
})

function ChestModal({ onClose }) {
  const { dispatch, config } = usePlayer()
  const [opened, setOpened] = useState(false)

  // lid pops after a beat, reward is granted exactly once
  useEffect(() => {
    const t = setTimeout(() => {
      setOpened(true)
      dispatch({ type: 'CHEST_CLAIM', amount: config.dailyChestCoins })
      sfx.pop()
      sfx.fanfare()
      speak(`כל הכבוד! סיימת את כל המשימות של היום. קיבלת ${config.dailyChestCoins} מטבעות!`, { delay: 300 })
    }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--t-overlay) backdrop-blur-sm p-4">
      <div className="anim-zoom-in bg-white rounded-3xl border-8 border-(--t-side-deep) shadow-2xl w-full max-w-sm max-h-full overflow-y-auto text-center">
        <div className="p-4 bg-gradient-to-br from-yellow-300 to-amber-500 border-b-8 border-black/10">
          <h2 className="text-3xl font-black text-white drop-shadow-md">תיבת האוצר!</h2>
        </div>

        <div className="p-8 flex flex-col items-center gap-5 bg-slate-50">
          {/* chest */}
          <div className="relative w-36 h-32">
            {/* coin burst */}
            {opened && (
              <div className="absolute inset-0 pointer-events-none z-20">
                {CHEST_BURST.map((p) => (
                  <div
                    key={p.id}
                    className="anim-coin-burst absolute left-1/2 top-1/3 w-4 h-4 -ml-2 -mt-2 rounded-full bg-yellow-400 border-2 border-yellow-700 shadow"
                    style={{ '--dx': p.dx, '--dy': p.dy, animationDelay: `${p.delay}s` }}
                  ></div>
                ))}
              </div>
            )}
            {/* glow inside */}
            {opened && (
              <div className="absolute left-3 right-3 top-8 bottom-2 rounded-xl bg-gradient-to-t from-amber-400 to-yellow-200 anim-vault-glow"></div>
            )}
            {/* body */}
            <div className="absolute left-0 right-0 bottom-0 h-20 rounded-b-2xl rounded-t-md bg-gradient-to-b from-pink-500 to-fuchsia-700 border-4 border-fuchsia-900 z-10">
              <div className="absolute left-1/2 -ml-3 top-2 w-6 h-7 bg-yellow-400 border-4 border-fuchsia-900 rounded-md"></div>
            </div>
            {/* lid */}
            <div className={`absolute left-0 right-0 top-4 h-12 rounded-t-2xl bg-gradient-to-b from-pink-300 to-pink-500 border-4 border-fuchsia-900 z-10 ${opened ? 'anim-chest-lid' : ''}`}>
              <div className="absolute inset-x-2 top-1.5 h-1.5 rounded bg-white/50"></div>
            </div>
          </div>

          {opened ? (
            <div className="anim-pop flex items-center gap-2 bg-yellow-100 border-4 border-yellow-400 rounded-2xl px-6 py-2" dir="ltr">
              <Coins size={26} className="text-yellow-600 fill-yellow-300" />
              <span className="text-3xl font-black text-yellow-700 tabular-nums">+{config.dailyChestCoins}</span>
            </div>
          ) : (
            <p className="font-black text-slate-400 tracking-widest">נפתח…</p>
          )}

          <p className="font-bold text-slate-600">
            כל הכבוד! סיימת את כל המשימות של היום 🎉
          </p>

          <button
            onClick={onClose}
            disabled={!opened}
            className="w-full bg-green-500 hover:bg-green-400 text-white text-xl font-black py-3 rounded-2xl border-b-8 border-green-700 active:border-b-0 active:translate-y-2 transition-all disabled:opacity-50"
          >
            יש! 🎉
          </button>
        </div>
      </div>
    </div>
  )
}
