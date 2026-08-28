import { useEffect, useState, createContext, useContext } from 'react'
import { Gamepad2, Store, BarChart3, Trophy, Coins, Lock, Flame, Music, Joystick, Shirt, Palette, Volume2, VolumeX, Rocket, Sparkles } from 'lucide-react'
import { usePlayer, levelCost, getEquipped } from './context/PlayerContext.jsx'
import { useTheme } from './context/ThemeContext.jsx'
import { playMusic, stopMusic, isMusicOn, setMusicOn } from './match/music.js'
import { isSpeechOn, setSpeechOn, speak } from './match/speak.js'
import ThemePicker from './screens/ThemePicker.jsx'
import EventBoard from './screens/EventBoard.jsx'
import Closet from './screens/Closet.jsx'
import World from './screens/World.jsx'
import Shop from './screens/Shop.jsx'
import Trophies from './screens/Trophies.jsx'
import Arcade from './screens/Arcade.jsx'
import CoachStats from './screens/CoachStats.jsx'
import MatchEngine from './match/MatchEngine.jsx'
import Avatar from './avatar/Avatar.jsx'
import wardrobe from './data/wardrobe.json'
import { EVENTS } from './data/events.js'

const ToastContext = createContext(() => {})
export const useToast = () => useContext(ToastContext)

const TABS = [
  { id: 'events', label: 'משימות', Icon: Gamepad2, color: 'bg-green-500', active: 'text-green-300' },
  { id: 'closet', label: 'ארון', Icon: Shirt, color: 'bg-pink-500', active: 'text-pink-300' },
  { id: 'world', label: 'העולם שלי', short: 'העולם', Icon: Sparkles, color: 'bg-fuchsia-500', active: 'text-fuchsia-300' },
  { id: 'rewards', label: 'פרסים', Icon: Store, color: 'bg-purple-500', active: 'text-purple-300' },
  { id: 'arcade', label: 'משחקים', Icon: Joystick, color: 'bg-sky-500', active: 'text-sky-300' },
  { id: 'trophies', label: 'גביעים', Icon: Trophy, color: 'bg-yellow-500', active: 'text-yellow-300' },
]

// Dev deep-links (used with ?theme=): ?tab=closet|rewards|arcade|trophies|admin
// opens a tab directly, ?match=<eventId> jumps straight into a practice match.
function urlParam(name, valid) {
  try {
    const v = new URLSearchParams(window.location.search).get(name)
    return v && valid(v) ? v : null
  } catch {
    return null
  }
}

export default function App() {
  const { state, dispatch, playedToday } = usePlayer()
  const { theme, clearTheme } = useTheme()
  const [activeTab, setActiveTab] = useState(
    () => urlParam('tab', (v) => [...TABS.map((t) => t.id), 'admin'].includes(v)) ?? 'events',
  )
  const [toast, setToast] = useState(null)
  // { event, mode, practice } while a match is running
  const [match, setMatch] = useState(() => {
    const id = urlParam('match', (v) => EVENTS.some((e) => e.id === v))
    return id ? { event: EVENTS.find((e) => e.id === id), mode: 'classic', practice: true } : null
  })
  const [musicOn, setMusicOnState] = useState(isMusicOn())
  const [speechOn, setSpeechOnState] = useState(isSpeechOn())

  // background music follows app state; first pointer tap unlocks WebAudio
  useEffect(() => {
    if (!musicOn || !theme) { stopMusic(); return }
    const track = match ? 'match' : 'lobby'
    playMusic(track)
    const kick = () => playMusic(track)
    window.addEventListener('pointerdown', kick, { once: true })
    return () => window.removeEventListener('pointerdown', kick)
  }, [match, musicOn, theme])

  const toggleMusic = () => {
    setMusicOn(!musicOn)
    setMusicOnState(!musicOn)
  }
  const toggleSpeech = () => {
    setSpeechOn(!speechOn)
    setSpeechOnState(!speechOn)
  }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    speak(message)
  }

  useEffect(() => {
    if (state.corrupt) {
      showToast('הנתונים השמורים נפגמו — התחלנו מחדש', 'error')
      dispatch({ type: 'CLEAR_CORRUPT_FLAG' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Picking a world dresses the doll in that world's preset — but only over
  // free starter items, never over something she chose and paid for.
  useEffect(() => {
    if (!theme) return
    const free = new Set(wardrobe.filter((i) => i.price === 0).map((i) => i.id))
    const equipped = getEquipped(state, theme.id)
    for (const [slot, itemId] of Object.entries(theme.avatarPreset)) {
      const current = equipped[slot]
      if (state.avatar.owned.includes(itemId) && current !== itemId && (current === null || free.has(current))) {
        dispatch({ type: 'AVATAR_EQUIP', themeId: theme.id, slot, itemId })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme?.id])

  // She picks a world on every launch
  if (!theme) return <ThemePicker />

  const xpPct = Math.min(100, Math.round((state.xp / levelCost(state.level)) * 100))

  return (
    <ToastContext.Provider value={showToast}>
      <div
        dir="rtl"
        data-theme={theme.id}
        style={{ ...theme.vars, backgroundImage: 'radial-gradient(circle at center, var(--t-bg-from) 0%, var(--t-bg-to) 100%)' }}
        className="flex flex-col lg:flex-row h-dvh w-full text-slate-800 font-sans overflow-hidden selection:bg-yellow-400 selection:text-black"
      >
        {/* SIDEBAR — tablet/desktop only (right side in RTL); phones get the bottom nav */}
        <aside className="hidden lg:flex w-64 bg-(--t-side) border-e-4 border-(--t-side-deep) flex-col relative z-20 shadow-2xl">
          <div className="p-4 md:p-6 border-b-4 border-(--t-side-deep) flex flex-col items-start">
            <div className="bg-yellow-400 p-2 md:p-3 rounded-2xl border-b-4 border-yellow-600 shadow-lg mb-2 rotate-3">
              <Rocket className="text-red-600 h-8 w-8 md:h-10 md:w-10 fill-current" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-wide drop-shadow-md leading-tight">
              המסע של<br /><span className="text-(--t-accent)">מיכאל</span>
            </h1>
          </div>

          <nav className="flex-1 p-2 md:p-4 space-y-3 mt-4">
            {TABS.map((t) => (
              <NavItem
                key={t.id}
                icon={<t.Icon size={28} className="md:ms-0 md:me-3" />}
                label={t.label}
                isActive={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
                color={t.color}
              />
            ))}
          </nav>

          <div className="p-2 md:p-4 border-t-4 border-(--t-side-deep) bg-black/15 space-y-2">
            <button
              onClick={clearTheme}
              className="flex items-center w-full p-3 rounded-xl transition-all duration-200 font-black tracking-wide bg-(--t-nav) text-white hover:bg-(--t-side-deep) border-b-4 border-(--t-side-deep)"
            >
              <Palette className="me-3" size={24} />
              <span>{theme.emoji} להחליף עולם</span>
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center w-full p-3 rounded-xl transition-all duration-200 font-black tracking-wide
                ${activeTab === 'admin'
                  ? 'bg-slate-700 text-white border-b-4 border-slate-900 scale-95'
                  : 'bg-(--t-side) text-(--t-text-soft) hover:bg-slate-700 hover:text-white border-b-4 border-transparent hover:border-slate-900'}`}
            >
              <BarChart3 className="me-3" size={24} />
              <span>הורים</span>
              <Lock className="ms-auto opacity-50" size={16} />
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 flex flex-col relative overflow-hidden min-h-0">
          <header className="h-16 lg:h-24 shrink-0 bg-(--t-side)/80 backdrop-blur-md border-b-4 border-(--t-side-deep) flex items-center justify-between px-3 lg:px-8 z-10 shadow-md">
            <div className="flex items-center gap-2 lg:gap-4">
              <button
                onClick={() => setActiveTab('closet')}
                aria-label="הארון שלי"
                className="w-12 h-12 lg:w-16 lg:h-16 bg-white rounded-xl lg:rounded-2xl border-4 border-(--t-accent) flex items-end justify-center shadow-lg relative overflow-hidden active:scale-95 transition-transform"
              >
                <Avatar size={64} className="lg:scale-110 origin-bottom" />
              </button>
              <div className="flex flex-col">
                <span className="text-base lg:text-2xl text-white font-black drop-shadow-md tracking-wide leading-tight">מיכאל</span>
                <div className="flex items-center gap-1.5 lg:gap-2 w-16 sm:w-28 lg:w-48">
                  <span className="text-[10px] lg:text-xs font-black text-(--t-text-soft) whitespace-nowrap">רמה {state.level}</span>
                  <div className="flex-1 h-3 lg:h-4 bg-black/40 rounded-full border-2 border-(--t-side-deep) overflow-hidden relative">
                    <div
                      className="absolute top-0 start-0 h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000"
                      style={{ width: `${xpPct}%` }}
                    ></div>
                    <div className="absolute top-0 start-0 w-full h-1/2 bg-white/20"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 lg:gap-3">
              <button
                onClick={toggleSpeech}
                aria-label={speechOn ? 'כיבוי הקראה' : 'הפעלת הקראה'}
                className={`w-11 h-11 rounded-xl border-b-4 flex items-center justify-center transition-all active:translate-y-0.5 active:border-b-2
                  ${speechOn ? 'bg-green-500 border-green-700 text-white' : 'bg-black/40 border-(--t-side-deep) text-(--t-text-soft)'}`}
              >
                {speechOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button
                onClick={toggleMusic}
                aria-label={musicOn ? 'כיבוי מוזיקה' : 'הפעלת מוזיקה'}
                className={`w-11 h-11 rounded-xl border-b-4 flex items-center justify-center transition-all active:translate-y-0.5 active:border-b-2 relative
                  ${musicOn ? 'bg-green-500 border-green-700 text-white' : 'bg-black/40 border-(--t-side-deep) text-(--t-text-soft)'}`}
              >
                <Music size={18} />
                {!musicOn && <span className="absolute w-7 h-0.5 bg-red-400 rotate-45 rounded"></span>}
              </button>
              {state.streak.count > 0 && (
                <div className="hidden sm:flex items-center gap-1 bg-orange-500 border-2 border-orange-300 rounded-xl px-2 py-1 lg:px-3 lg:py-1.5 shadow-md rotate-2">
                  <Flame size={16} className="text-yellow-200 fill-yellow-300" />
                  <span className="text-white font-black text-sm lg:text-lg tabular-nums">{state.streak.count}</span>
                </div>
              )}
              <div className="flex items-center bg-black/40 border-2 sm:border-4 border-(--t-side-deep) rounded-xl lg:rounded-2xl px-2 sm:px-2.5 py-1 lg:px-6 lg:py-3 shadow-inner -rotate-1">
                <div className="bg-yellow-400 p-1 lg:p-1.5 rounded-full me-1 sm:me-1.5 lg:me-3 border-2 border-yellow-600 shadow-sm">
                  <Coins className="text-yellow-900 fill-yellow-200 w-4 h-4 lg:w-5 lg:h-5" />
                </div>
                <span className="text-base sm:text-lg lg:text-3xl text-yellow-400 font-black tracking-wide drop-shadow-sm tabular-nums">
                  {state.coins.toLocaleString()}
                </span>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-3 lg:p-6 relative">
            {/* no z-index here: it would cap the fixed game overlays below the z-20 sidebar */}
            <div className="relative max-w-5xl mx-auto pb-6 lg:pb-20">
              {activeTab === 'events' && (
                <EventBoard
                  onStartMatch={(event, mode) => setMatch({ event, mode, practice: playedToday(event.id) })}
                />
              )}
              {activeTab === 'closet' && <Closet />}
              {activeTab === 'world' && <World />}
              {activeTab === 'rewards' && <Shop />}
              {activeTab === 'arcade' && <Arcade />}
              {activeTab === 'trophies' && <Trophies />}
              {activeTab === 'admin' && <CoachStats />}
            </div>
          </div>
        </main>

        {/* BOTTOM NAV — phones only */}
        <nav
          className="lg:hidden shrink-0 grid grid-cols-7 bg-(--t-side) border-t-4 border-(--t-side-deep) z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.3)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {TABS.map((t) => (
            <BottomNavItem
              key={t.id}
              icon={<t.Icon size={24} />}
              label={t.short ?? t.label}
              isActive={activeTab === t.id}
              activeColor={t.active}
              onClick={() => setActiveTab(t.id)}
            />
          ))}
          <BottomNavItem
            icon={<BarChart3 size={24} />}
            label="הורים"
            isActive={activeTab === 'admin'}
            activeColor="text-slate-200"
            onClick={() => setActiveTab('admin')}
          />
        </nav>

        {/* MATCH OVERLAY */}
        {match && (
          <MatchEngine
            key={match.startedAt ?? 0}
            event={match.event}
            mode={match.mode}
            practice={match.practice}
            onExit={() => setMatch(null)}
            onPlayAgain={() => setMatch({ event: match.event, mode: match.mode, practice: true, startedAt: Date.now() })}
          />
        )}

        {/* TOAST */}
        {toast && (
          <div className="fixed top-6 left-1/2 z-[100] anim-toast" style={{ transform: 'translateX(-50%)' }}>
            <div
              dir="rtl"
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl border-4 shadow-2xl font-black tracking-wide ${
                toast.type === 'success'
                  ? 'bg-green-500 border-green-700 text-white'
                  : 'bg-red-500 border-red-700 text-white'
              }`}
            >
              <span className="text-2xl">{toast.type === 'success' ? '🎉' : '😕'}</span>
              <span className="text-lg md:text-xl drop-shadow-sm">{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

function BottomNavItem({ icon, label, isActive, activeColor, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 font-black tracking-wide transition-colors relative
        ${isActive ? `${activeColor}` : 'text-(--t-text-soft) active:text-white'}`}
    >
      {/* active indicator bar */}
      <span className={`absolute top-0 left-1/4 right-1/4 h-1 rounded-b-full transition-opacity ${isActive ? 'bg-yellow-400 opacity-100' : 'opacity-0'}`}></span>
      {icon}
      <span className="text-[11px] leading-none">{label}</span>
    </button>
  )
}

function NavItem({ icon, label, isActive, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-start w-full p-2 md:p-3 rounded-2xl transition-all duration-200 font-black tracking-wide
        ${isActive
          ? `${color} text-white border-b-4 border-black/20 scale-95 shadow-inner`
          : 'bg-(--t-nav) text-white/90 hover:bg-(--t-side-deep) hover:text-white border-b-4 border-(--t-side-deep) hover:translate-y-1'}`}
    >
      {icon}
      <span className="text-lg">{label}</span>
    </button>
  )
}
