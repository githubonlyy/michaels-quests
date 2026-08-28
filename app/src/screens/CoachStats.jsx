import { useMemo, useState } from 'react'
import { BarChart3, Lock, Trophy, Zap, ShoppingBag, KeyRound, Delete, Trash2 } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useToast } from '../App.jsx'

const RESULT_HE = { WIN: 'ניצחון', DRAW: 'תיקו', LOSS: 'הפסד' }

// purchase.kind → badge. Only 'reward' needs the parent to actually do something.
const KIND_BADGE = {
  reward: { label: '🎁 פרס אמיתי', cls: 'bg-yellow-300 text-yellow-950 border-yellow-500' },
  wardrobe: { label: '👗 בגד', cls: 'bg-pink-100 text-pink-700 border-pink-200' },
  arcade: { label: '🎮 משחק', cls: 'bg-slate-200 text-slate-600 border-slate-300' },
}

export default function CoachStats() {
  const { state, config } = usePlayer()
  const [unlocked, setUnlocked] = useState(false)

  if (!unlocked) return <PinGate pin={state.pin} config={config} onUnlock={() => setUnlocked(true)} />
  return <Dashboard />
}

/* ---------- PIN GATE ---------- */

function PinGate({ pin, config, onUnlock }) {
  const [entry, setEntry] = useState('')
  const [tries, setTries] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [, forceTick] = useState(0)

  const now = Date.now()
  const locked = now < lockedUntil
  const lockedSecs = Math.ceil((lockedUntil - now) / 1000)

  const press = (d) => {
    if (locked || entry.length >= 4) return
    const next = entry + d
    setEntry(next)
    if (next.length === 4) {
      if (next === pin) {
        onUnlock()
      } else {
        const nextTries = tries + 1
        setTries(nextTries)
        setEntry('')
        if (nextTries >= config.pinLockoutTries) {
          const until = Date.now() + config.pinLockoutSec * 1000
          setLockedUntil(until)
          setTries(0)
          const iv = setInterval(() => {
            forceTick((t) => t + 1)
            if (Date.now() >= until) clearInterval(iv)
          }, 1000)
        }
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="bg-white rounded-3xl border-8 border-slate-800 shadow-2xl p-8 flex flex-col items-center w-full max-w-sm">
        <div className="bg-slate-800 p-4 rounded-2xl border-b-4 border-slate-950 mb-4 rotate-3">
          <Lock className="text-white w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-1">אזור הורים</h2>
        <p className="font-bold text-slate-500 mb-6">הקישו קוד</p>

        {/* digits and keypad are LTR — numeric layout */}
        <div className="flex gap-3 mb-6" dir="ltr">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`w-12 h-14 rounded-xl border-4 flex items-center justify-center text-3xl font-black ${
                entry.length > i ? 'bg-slate-800 border-slate-900 text-white' : 'bg-slate-100 border-slate-200 text-slate-300'
              }`}
            >
              {entry.length > i ? '•' : ''}
            </div>
          ))}
        </div>

        {locked ? (
          <p className="font-black text-red-500 text-lg mb-4">נעול! נסו שוב בעוד {lockedSecs} שניות</p>
        ) : tries > 0 ? (
          <p className="font-black text-red-500 mb-4">קוד שגוי ({tries}/{config.pinLockoutTries})</p>
        ) : null}

        <div className="grid grid-cols-3 gap-2 w-full" dir="ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              disabled={locked}
              className="bg-slate-100 text-slate-800 text-2xl font-black py-3 rounded-xl border-b-4 border-slate-300 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-40"
            >
              {k}
            </button>
          ))}
          <div></div>
          <button
            onClick={() => press('0')}
            disabled={locked}
            className="bg-slate-100 text-slate-800 text-2xl font-black py-3 rounded-xl border-b-4 border-slate-300 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-40"
          >
            0
          </button>
          <button
            onClick={() => setEntry(entry.slice(0, -1))}
            disabled={locked}
            aria-label="מחיקת ספרה"
            className="bg-red-400 text-white py-3 rounded-xl border-b-4 border-red-600 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center disabled:opacity-40"
          >
            <Delete size={24} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- DASHBOARD ---------- */

function Dashboard() {
  const { state, dispatch, config } = usePlayer()
  const showToast = useToast()
  const [newPin, setNewPin] = useState('')

  const stats = useMemo(() => {
    const paid = state.battleLog.filter((l) => !l.practice)
    const wins = paid.filter((l) => l.result === 'WIN').length
    const winRate = paid.length ? Math.round((wins / paid.length) * 100) : 0
    const avgTime = state.battleLog.length
      ? Math.round((state.battleLog.reduce((s, l) => s + (l.avgTimeSec || 0), 0) / state.battleLog.length) * 10) / 10
      : 0

    const bySubject = {}
    for (const l of state.battleLog) {
      bySubject[l.subject] ??= { correct: 0, total: 0 }
      bySubject[l.subject].correct += l.correct
      bySubject[l.subject].total += l.total ?? config.questionsPerMatch
    }
    return { winRate, avgTime, wins, bySubject }
  }, [state.battleLog, config.questionsPerMatch])

  const rewardCount = state.purchases.filter((p) => p.kind === 'reward').length

  const changePin = () => {
    if (!/^\d{4}$/.test(newPin)) {
      showToast('הקוד חייב להיות 4 ספרות', 'error')
      return
    }
    dispatch({ type: 'SET_PIN', pin: newPin })
    setNewPin('')
    showToast('הקוד עודכן!', 'success')
  }

  const resetAll = () => {
    const ok = window.confirm(
      'למחוק את כל הנתונים של מיכאל?\nמטבעות, רמה, גביעים, בגדים ורכישות יימחקו. אי אפשר לבטל!',
    )
    if (!ok) return
    dispatch({ type: 'RESET_ALL' })
    showToast(`כל הנתונים אופסו. הקוד חזר ל-${config.defaultPin}`, 'success')
  }

  return (
    <div className="space-y-6 anim-fade-in">
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border-4 border-slate-900 shadow-xl">
        <h2 className="text-2xl md:text-3xl font-black text-white drop-shadow-md flex items-center gap-3">
          <BarChart3 className="text-(--t-accent)" size={32} />
          לוח הורים
        </h2>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="אחוז ניצחונות" value={`${stats.winRate}%`} icon={<div className="w-12 h-12 rounded-full border-8 border-slate-100 border-t-green-500 border-r-green-500 rotate-45"></div>} />
        <MetricCard label="זמן ממוצע לשאלה" value={`${stats.avgTime} שנ׳`} icon={<Zap className="text-yellow-400 fill-yellow-200 h-10 w-10" />} />
        <MetricCard label={'סה"כ ניצחונות'} value={stats.wins} icon={<Trophy className="text-yellow-500 fill-yellow-200 h-10 w-10" />} />
      </div>

      {/* PER-SUBJECT ACCURACY */}
      <div className="bg-white border-4 border-slate-200 rounded-3xl shadow-lg p-6">
        <h3 className="text-lg font-black text-slate-600 mb-4">דיוק לפי נושא</h3>
        {Object.keys(stats.bySubject).length === 0 ? (
          <p className="font-bold text-slate-400">עדיין אין משחקים — שלחו את מיכאל לשחק!</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(stats.bySubject).map(([subject, s]) => {
              const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0
              return (
                <div key={subject}>
                  <div className="flex justify-between font-black text-sm text-slate-600 mb-1">
                    <span>{subject}</span>
                    <span className="tabular-nums" dir="ltr">{pct}% ({s.correct}/{s.total})</span>
                  </div>
                  {/* block child sits at inline-start, so the bar fills from the right in RTL */}
                  <div className="h-4 bg-slate-100 rounded-full border-2 border-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* BATTLE LOG */}
      <div className="bg-white border-4 border-slate-200 rounded-3xl overflow-hidden shadow-lg">
        <div className="bg-slate-100 px-6 py-4 border-b-4 border-slate-200">
          <h3 className="text-lg font-black text-slate-600">יומן משחקים</h3>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-start border-collapse">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <Th>מתי</Th><Th>משימה</Th><Th>תוצאה</Th><Th>ניקוד</Th><Th>מטבעות</Th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100 font-bold">
              {state.battleLog.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-6 text-slate-400 font-bold text-center">עדיין אין משחקים</td></tr>
              )}
              {state.battleLog.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 text-slate-500 whitespace-nowrap tabular-nums">
                    {new Date(log.ts).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-3 text-slate-800 whitespace-nowrap">
                    {log.subject}
                    {log.practice && <span className="ms-2 text-xs bg-slate-100 text-slate-500 border border-slate-200 rounded px-1.5 py-0.5">אימון</span>}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`px-3 py-1 rounded-lg text-sm font-black ${
                      log.result === 'LOSS' ? 'bg-red-100 text-red-600 border-2 border-red-200'
                      : log.result === 'DRAW' ? 'bg-slate-200 text-slate-600 border-2 border-slate-300'
                      : 'bg-green-100 text-green-600 border-2 border-green-200'
                    }`}>
                      {RESULT_HE[log.result] ?? log.result}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-600 tabular-nums" dir="ltr">{log.correct}/{log.total ?? config.questionsPerMatch}</td>
                  <td className={`px-6 py-3 font-black tabular-nums ${log.coins > 0 ? 'text-green-500' : 'text-slate-400'}`} dir="ltr">
                    {log.coins > 0 ? `+${log.coins}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PURCHASES */}
      <div className="bg-white border-4 border-slate-200 rounded-3xl shadow-lg p-6">
        <h3 className="text-lg font-black text-slate-600 mb-1 flex items-center gap-2">
          <ShoppingBag size={20} /> רכישות
          {rewardCount > 0 && (
            <span className="ms-1 text-xs bg-yellow-300 text-yellow-950 border border-yellow-500 rounded-full px-2 py-0.5 tabular-nums">
              {rewardCount} 🎁
            </span>
          )}
        </h3>
        <p className="text-sm font-bold text-slate-400 mb-4">
          רק 🎁 פרס אמיתי דורש פעולה שלכם — בגדים ומשחקים נפתחים לבד באפליקציה.
        </p>
        {state.purchases.length === 0 ? (
          <p className="font-bold text-slate-400">עדיין אין רכישות</p>
        ) : (
          <ul className="space-y-2">
            {state.purchases.map((p) => {
              const badge = KIND_BADGE[p.kind] ?? KIND_BADGE.reward
              const isReward = p.kind === 'reward'
              return (
                <li
                  key={p.id}
                  className={`flex flex-wrap justify-between items-center gap-2 border-2 rounded-xl px-4 py-2 font-bold
                    ${isReward ? 'bg-yellow-50 border-yellow-300 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`text-xs border rounded-full px-2 py-0.5 whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
                    <span>{p.title}</span>
                  </span>
                  <span className="text-sm text-slate-400 tabular-nums whitespace-nowrap">
                    {new Date(p.ts).toLocaleDateString('he-IL')} · {p.cost.toLocaleString('he-IL')} מטבעות
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* CHANGE PIN */}
      <div className="bg-white border-4 border-slate-200 rounded-3xl shadow-lg p-6">
        <h3 className="text-lg font-black text-slate-600 mb-4 flex items-center gap-2">
          <KeyRound size={20} /> החלפת קוד
        </h3>
        <div className="flex gap-3">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            placeholder="קוד חדש (4 ספרות)"
            aria-label="קוד חדש"
            className="flex-1 min-w-0 bg-slate-100 border-4 border-slate-200 rounded-xl px-4 py-2 font-black text-xl tracking-widest focus:outline-none focus:border-(--t-accent)"
          />
          <button
            onClick={changePin}
            className="bg-slate-800 text-white font-black px-6 rounded-xl border-b-4 border-slate-950 active:border-b-0 active:translate-y-1 transition-all"
          >
            שמירה
          </button>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="bg-white border-4 border-red-200 rounded-3xl shadow-lg p-6">
        <h3 className="text-lg font-black text-red-600 mb-1 flex items-center gap-2">
          <Trash2 size={20} /> איפוס כל הנתונים
        </h3>
        <p className="text-sm font-bold text-slate-400 mb-4">
          מוחק מטבעות, רמה, גביעים, בגדים ורכישות ומחזיר את הקוד לברירת המחדל. אי אפשר לבטל.
        </p>
        <button
          onClick={resetAll}
          className="bg-red-500 text-white font-black px-6 py-2 rounded-xl border-b-4 border-red-700 hover:bg-red-400 active:border-b-0 active:translate-y-1 transition-all"
        >
          איפוס כל הנתונים
        </button>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon }) {
  return (
    <div className="bg-white border-4 border-slate-200 p-6 rounded-3xl shadow-lg flex flex-col">
      <p className="text-sm font-black text-slate-400 mb-2">{label}</p>
      <div className="flex items-end justify-between mt-auto">
        <p className="text-4xl text-slate-800 font-black tabular-nums">{value}</p>
        {icon}
      </div>
    </div>
  )
}

function Th({ children }) {
  return (
    <th className="px-6 py-4 text-xs font-black text-slate-400 text-start border-b-2 border-slate-200">
      {children}
    </th>
  )
}
