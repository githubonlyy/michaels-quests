import { useEffect } from 'react'
import { THEMES, THEME_IDS } from '../data/themes.js'
import { useTheme } from '../context/ThemeContext.jsx'
import { speak } from '../match/speak.js'
import { sfx } from '../match/sounds.js'
import Avatar from '../avatar/Avatar.jsx'

const PROMPT = 'איזה עולם נבחר היום?'

/**
 * Full-screen gate shown on every launch: three big world cards. The last
 * pick gets a "אתמול בחרת" ribbon so she can tap the same one fast.
 */
export default function ThemePicker() {
  const { setTheme, lastTheme } = useTheme()

  useEffect(() => {
    // may be blocked before the first gesture on some browsers — harmless
    speak(PROMPT, { delay: 400 })
  }, [])

  const pick = (id) => {
    sfx.fanfare()
    speak(`${THEMES[id].label}! יאללה!`)
    setTheme(id)
  }

  return (
    <div
      dir="rtl"
      className="h-dvh w-full flex flex-col items-center justify-center gap-3 sm:gap-6 md:gap-10 short:gap-2 p-3 sm:p-4 md:p-8 short:p-2 font-sans overflow-y-auto"
      style={{ backgroundImage: 'radial-gradient(circle at center, #fbcfe8 0%, #a78bfa 100%)' }}
    >
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl md:text-5xl short:text-xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.25)] leading-tight">
          המסע של מיכאל
        </h1>
        <button
          onClick={() => speak(PROMPT)}
          className="mt-1.5 md:mt-3 short:mt-1 min-h-11 inline-flex items-center justify-center text-base sm:text-xl md:text-3xl short:text-base font-black text-purple-900 bg-white/70 px-4 sm:px-5 py-2 short:py-1 rounded-full border-b-4 border-purple-300 active:border-b-0 active:translate-y-1 transition-all"
        >
          🔊 {PROMPT}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 md:gap-8 w-full max-w-4xl">
        {THEME_IDS.map((id) => {
          const t = THEMES[id]
          const isLast = id === lastTheme
          return (
            <button
              key={id}
              onClick={() => pick(id)}
              style={{ ...t.vars, backgroundImage: 'linear-gradient(160deg, var(--t-bg-from), var(--t-bg-to))' }}
              className="group relative rounded-[2rem] border-b-[10px] border-black/25 shadow-2xl p-1.5 hover:-translate-y-2 active:translate-y-2 active:border-b-0 transition-all duration-200"
            >
              {isLast && (
                <span className="absolute -top-3 inset-x-0 mx-auto w-fit bg-yellow-400 text-yellow-900 font-black text-xs md:text-sm px-3 py-1 rounded-full border-2 border-yellow-600 shadow z-10 whitespace-nowrap">
                  ⭐ הבחירה האחרונה
                </span>
              )}
              <div className="bg-white/90 rounded-[1.6rem] flex flex-row sm:flex-col items-center gap-3 sm:gap-2 md:gap-3 short:gap-1 py-2.5 sm:py-5 md:py-8 short:py-2 px-3 sm:px-4">
                {/* each world has its own doll — show her so the pick is about "who am I today" */}
                <div className="relative h-24 sm:h-40 md:h-48 short:h-28 shrink-0 flex items-end justify-center group-hover:scale-105 transition-transform">
                  <Avatar size={190} themeId={id} className="anim-float-bob max-h-full" />
                  <span className="absolute -top-1 -end-4 sm:-end-6 text-3xl sm:text-4xl md:text-5xl drop-shadow-md">{t.emoji}</span>
                </div>
                <div className="flex-1 min-w-0 flex flex-col items-start sm:items-center gap-0.5 sm:gap-2 md:gap-3 text-start sm:text-center">
                <span className="text-2xl sm:text-3xl md:text-4xl short:text-xl font-black text-slate-800">{t.label}</span>
                <span className="text-sm md:text-base font-bold text-slate-500 short:hidden">{t.subtitle}</span>
                <span className="flex gap-1 text-lg sm:text-xl sm:mt-1 short:hidden">
                  {t.particles.slice(0, 4).map((p, i) => (
                    <span key={i}>{p}</span>
                  ))}
                </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
