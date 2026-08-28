import { useEffect, useState } from 'react'
import { Lock, Palette, Trophy, Volume2 } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { EVENTS } from '../data/events.js'
import { speak } from '../match/speak.js'
import { sfx } from '../match/sounds.js'
import Avatar from '../avatar/Avatar.jsx'
import Dance from '../world/Dance.jsx'
import Draw from '../world/Draw.jsx'
import Drive from '../world/Drive.jsx'

const GREETING = 'שלום מיכאל! מה נעשה היום?'

// His world: activities the doll stars in. Dance and drawing are always open;
// driving is a game, so it waits behind the same daily study goal as the arcade.
const ACTIVITIES = [
  { id: 'dance', emoji: '💃', title: 'ריקוד', he: 'רוקדים לפי הקצב!', color: 'bg-pink-500', border: 'border-pink-700', gated: false },
  { id: 'draw', emoji: '🎨', title: 'ציור', he: 'מציירים וצובעים!', color: 'bg-amber-400', border: 'border-amber-600', gated: false },
  { id: 'drive', emoji: '🚗', title: 'נהיגה', he: 'נוסעים ואוספים!', color: 'bg-sky-500', border: 'border-sky-700', gated: true },
]

export default function World() {
  const { state, dispatch, playedToday, config } = usePlayer()
  const { theme, clearTheme } = useTheme()
  const [open, setOpen] = useState(null) // { id, run }

  useEffect(() => {
    speak(GREETING, { delay: 300 })
  }, [])

  const goal = config.dailyGoal
  const doneCount = EVENTS.filter((e) => playedToday(e.id)).length
  const unlocked = doneCount >= goal

  const start = (a) => {
    if (a.gated && !unlocked) {
      sfx.buzz()
      speak(`קודם ${goal} משימות, ואז נוסעים!`)
      return
    }
    sfx.click()
    speak(a.title)
    setOpen({ id: a.id, run: 1 })
  }

  return (
    <div className="space-y-3 sm:space-y-5 lg:space-y-6" dir="rtl">
      {/* HEADER — the doll greets him. The world switcher lives here too: only
          the ≥lg sidebar has one, so phones would otherwise be stuck in a world.
          On a phone it wraps onto its own full-width row (basis-full). */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 bg-(--t-panel) p-3 lg:p-4 rounded-2xl border-4 border-(--t-panel-border) backdrop-blur-sm">
        <div className="w-14 h-16 sm:w-16 sm:h-20 lg:w-24 lg:h-28 bg-white/90 rounded-2xl border-4 border-(--t-accent) flex items-end justify-center overflow-hidden shrink-0">
          <Avatar size={104} className="anim-float-bob" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white drop-shadow-md leading-tight">
            העולם של מיכאל<span className="hidden sm:inline"> {theme.emoji}</span>
          </h2>
          <p className="text-(--t-text-soft) font-bold text-sm sm:text-base mt-0.5 sm:mt-1 leading-snug">{GREETING}</p>
        </div>
        <button
          onClick={() => speak(GREETING)}
          aria-label="הקראה"
          className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-2xl bg-(--t-accent) text-slate-900 border-b-4 border-(--t-accent-deep) flex items-center justify-center shadow-md active:translate-y-1 active:border-b-0 transition-all"
        >
          <Volume2 size={30} strokeWidth={2.5} />
        </button>
        <button
          onClick={clearTheme}
          aria-label="להחליף עולם"
          className="basis-full sm:basis-auto min-h-14 sm:h-16 px-4 shrink-0 flex items-center justify-center gap-2 rounded-2xl bg-(--t-nav) text-white border-b-4 border-(--t-side-deep) font-black text-base sm:text-lg shadow-md active:translate-y-1 active:border-b-0 transition-all"
        >
          <Palette size={24} className="shrink-0" />
          <span className="whitespace-nowrap">{theme.emoji} להחליף עולם</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        {ACTIVITIES.map((a) => {
          const locked = a.gated && !unlocked
          const best = state.arcadeHighScores[a.id] || 0
          return (
            <button
              key={a.id}
              onClick={() => start(a)}
              className={`relative rounded-3xl border-b-8 shadow-xl text-start transition-all duration-200 overflow-hidden
                ${locked ? 'bg-slate-500 border-slate-700' : `${a.color} ${a.border} hover:-translate-y-1 active:translate-y-1 active:border-b-0`}`}
            >
              {/* phone: one compact row (emoji · text · action). sm+: the tall
                  centred card — `sm:contents` dissolves the phone text column. */}
              <div className="bg-white/95 m-1.5 rounded-[1.25rem] p-3.5 sm:p-3 lg:p-6 flex flex-row sm:flex-col items-center text-start sm:text-center gap-3.5 sm:gap-1.5 lg:gap-2 sm:min-h-[min(13rem,45vh)] lg:min-h-56">
                <span className={`shrink-0 text-6xl sm:text-5xl lg:text-8xl leading-none drop-shadow-md ${locked ? 'grayscale opacity-60' : ''}`}>{a.emoji}</span>
                <div className="flex-1 min-w-0 sm:contents">
                  <h3 className="font-black text-slate-800 text-xl sm:text-2xl lg:text-3xl leading-tight">{a.title}</h3>
                  <p className="font-bold text-slate-500 text-sm lg:text-base leading-snug">{a.he}</p>
                  {best > 0 && (
                    <span className="flex items-center gap-1 text-xs font-black text-slate-400 tabular-nums">
                      <Trophy size={12} className="text-yellow-500 fill-yellow-200" /> {best}
                    </span>
                  )}
                </div>
                {locked ? (
                  <span className="shrink-0 flex items-center gap-1.5 text-slate-500 font-black text-sm sm:mt-auto">
                    <Lock size={18} className="shrink-0" />
                    <span className="hidden sm:inline">אחרי {goal} משימות</span>
                    <span className="tabular-nums" dir="ltr">({Math.min(doneCount, goal)}/{goal})</span>
                  </span>
                ) : (
                  <span className={`${a.color} shrink-0 text-white font-black text-base sm:text-lg px-4 sm:px-6 py-2 rounded-xl border-b-4 border-black/25 sm:mt-auto anim-ready-pulse`}>
                    יאללה!
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {open?.id === 'dance' && <Dance key={open.run} onClose={() => setOpen(null)} />}
      {open?.id === 'draw' && <Draw key={open.run} onClose={() => setOpen(null)} />}
      {open?.id === 'drive' && (
        <Drive
          key={open.run}
          highScore={state.arcadeHighScores.drive || 0}
          onScore={(score) => dispatch({ type: 'ARCADE_SCORE', game: 'drive', score })}
          onRestart={() => setOpen((o) => ({ ...o, run: o.run + 1 }))}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
