import { useRef, useState } from 'react'
import { Coins, Lock, Trophy } from 'lucide-react'
import { EVENTS } from '../data/events.js'
import { ARCADE_GAMES, gameMeta } from '../data/arcadeGames.js'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useToast } from '../App.jsx'
import { sfx } from '../match/sounds.js'
import { speak } from '../match/speak.js'

// Arcade tab: fun-only games skinned by the active theme. New games are bought
// with coins; playing any of them still requires finishing the daily study goal.
export default function Arcade() {
  const { state, dispatch, playedToday, config } = usePlayer()
  const { theme } = useTheme()
  const [play, setPlay] = useState(null) // { id, run } — run bumps to remount/restart
  const [buying, setBuying] = useState(null) // { game, meta }
  const showToast = useToast()
  const lastBuyRef = useRef(0) // double-tap protection

  const goal = config.dailyGoal
  const doneCount = EVENTS.filter((e) => playedToday(e.id)).length
  const goalDone = Math.min(doneCount, goal)
  const unlocked = doneCount >= goal

  const startGame = (gm, meta) => {
    speak(meta.title)
    setPlay({ id: gm.id, run: 1 })
  }

  const confirmBuy = () => {
    const now = Date.now()
    if (now - lastBuyRef.current < 800) return
    lastBuyRef.current = now
    const { game, meta } = buying
    if (state.coins >= game.price) {
      dispatch({ type: 'ARCADE_BUY', game: { id: game.id, title: meta.title, price: game.price } })
      sfx.fanfare()
      showToast(`${meta.title} שלך!`, 'success')
    }
    setBuying(null)
  }

  return (
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <div className="flex items-center gap-2 bg-(--t-panel) p-3 lg:p-4 rounded-2xl border-4 border-(--t-panel-border) backdrop-blur-sm">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-wide drop-shadow-md flex-1 min-w-0">משחקים 🎮</h2>
        {!unlocked && (
          <span className="text-(--t-text-soft) font-bold text-xs sm:text-sm text-end leading-tight shrink-0">
            נפתח אחרי {goal} משימות ({goalDone}/{goal})
          </span>
        )}
      </div>

      {!unlocked && (
        <div className="flex items-center gap-2.5 sm:gap-3 bg-(--t-panel) border-4 border-(--t-panel-border) rounded-2xl p-3 lg:p-4">
          <Lock className="text-(--t-accent) shrink-0" size={26} />
          <p className="text-white font-bold text-sm sm:text-base leading-snug">
            קודם לומדים, אחר כך משחקים! סיימו {goal} משימות שונות במסך המשימות — ואז המשחקים נפתחים להיום.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {ARCADE_GAMES.map((gm) => {
          const meta = gameMeta(gm, theme)
          const owned = state.ownedGames.includes(gm.id)
          const best = state.arcadeHighScores[gm.id] || 0
          const playable = owned && unlocked
          const canAfford = state.coins >= gm.price
          return (
            <button
              key={gm.id}
              type="button"
              onClick={() => {
                if (playable) startGame(gm, meta)
                else if (owned) showToast(`קודם ${goal} משימות!`, 'error')
                else setBuying({ game: gm, meta })
              }}
              className={`relative rounded-3xl border-b-8 shadow-xl cursor-pointer transition-all duration-200 overflow-hidden text-start
                ${owned && !unlocked ? 'bg-slate-400 border-slate-600' : `${gm.color} ${gm.borderColor} hover:-translate-y-1 active:translate-y-1 active:border-b-0`}`}
            >
              <div className="bg-white/95 m-1.5 rounded-[1.25rem] p-3 sm:p-4 lg:p-5 flex flex-col items-center text-center gap-1.5 sm:gap-2">
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 shrink-0 rounded-2xl border-4 -rotate-3 flex items-center justify-center
                    ${playable ? `${gm.lightBg} ${gm.borderColor}` : owned ? 'bg-slate-200 border-slate-400' : `${gm.lightBg} ${gm.borderColor} opacity-80`}`}
                >
                  <span className={`text-4xl sm:text-5xl lg:text-6xl leading-none ${owned && !unlocked ? 'grayscale opacity-60' : ''}`}>{meta.emoji}</span>
                </div>
                <h3 className="font-black text-slate-800 leading-tight text-lg lg:text-xl">{meta.title}</h3>
                <p className="font-bold text-slate-500 text-xs sm:text-sm leading-snug">{meta.he}</p>
                {owned ? (
                  playable ? (
                    <span className={`${gm.color} text-white font-black text-base sm:text-lg px-4 sm:px-6 py-2 rounded-xl border-b-4 border-black/30 anim-ready-pulse`}>לשחק!</span>
                  ) : (
                    <Lock className="text-slate-400" size={26} />
                  )
                ) : (
                  <span
                    className={`flex items-center gap-1.5 font-black text-sm sm:text-base px-3 sm:px-4 py-2 rounded-xl border-b-4
                      ${canAfford ? 'bg-yellow-400 border-yellow-600 text-yellow-900' : 'bg-slate-300 border-slate-400 text-slate-500'}`}
                  >
                    <Coins size={16} className="fill-current" /> {gm.price.toLocaleString()}
                  </span>
                )}
                {best > 0 && (
                  <span className="flex items-center gap-1 text-xs sm:text-sm font-black text-slate-400 tabular-nums">
                    <Trophy size={14} className="text-yellow-500 fill-yellow-200 shrink-0" /> שיא: {best}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* BUY GAME CONFIRM */}
      {buying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--t-overlay) backdrop-blur-sm p-4">
          <div className="anim-zoom-in bg-white rounded-3xl border-8 border-(--t-side-deep) shadow-2xl w-full max-w-sm max-h-full overflow-y-auto text-center">
            <div className={`p-4 ${buying.game.color} border-b-8 border-black/10`}>
              <div className="text-5xl mb-1 drop-shadow">{buying.meta.emoji}</div>
              <h2 className="text-2xl font-black text-white drop-shadow-md">{buying.meta.title}</h2>
            </div>
            <div className="p-6 flex flex-col items-center gap-4 bg-slate-50">
              <p className="font-bold text-slate-600">{buying.meta.he}</p>
              <p className="font-black text-slate-800 text-lg">
                לקנות לתמיד ב-
                <span className="text-yellow-600 tabular-nums"> {buying.game.price.toLocaleString()} </span>
                מטבעות?
              </p>
              {state.coins < buying.game.price && (
                <p className="font-bold text-rose-500 text-sm">
                  חסרים {(buying.game.price - state.coins).toLocaleString()} מטבעות — ממשיכים ללמוד ולחסוך!
                </p>
              )}
              <div className="flex gap-3 w-full">
                <button
                  onClick={confirmBuy}
                  disabled={state.coins < buying.game.price}
                  className="flex-1 min-h-16 bg-yellow-400 text-yellow-950 text-xl font-black rounded-2xl border-b-8 border-yellow-600 active:border-b-0 active:translate-y-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  קונים!
                </button>
                <button
                  onClick={() => setBuying(null)}
                  className="flex-1 min-h-16 bg-slate-300 text-slate-700 text-xl font-black rounded-2xl border-b-8 border-slate-400 active:border-b-0 active:translate-y-2 transition-all"
                >
                  לא עכשיו
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE ARCADE GAME */}
      {play && (() => {
        const gm = ARCADE_GAMES.find((g) => g.id === play.id)
        const GameComponent = gm.Component
        return (
          <GameComponent
            key={play.run}
            highScore={state.arcadeHighScores[gm.id] || 0}
            onScore={(score) => dispatch({ type: 'ARCADE_SCORE', game: gm.id, score })}
            onRestart={() => setPlay((p) => ({ ...p, run: p.run + 1 }))}
            onClose={() => setPlay(null)}
          />
        )
      })()}
    </div>
  )
}
