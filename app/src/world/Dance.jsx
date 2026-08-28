// DANCE — the doll dances to chiptune in a four-lane rhythm game.
//
// Phases: pick (a song, or free dance) → play → result. Timing is anchored to
// the AudioContext clock (music.js getBeatClock); with music muted the stage
// runs on performance.now() at the same bpm with a soft tick on every beat.
// Notes live in the DOM and are moved from a requestAnimationFrame loop —
// React state only changes on events (hits, misses, beats), never per frame.
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Trophy, Star } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { ArcadeBackdrop } from '../arcade/ArcadeShell.jsx'
import Avatar from '../avatar/Avatar.jsx'
import { speak } from '../match/speak.js'
import { sfx } from '../match/sounds.js'
import { DANCE_SONGS, playMusic, getBeatClock } from '../match/music.js'
import {
  MOVES,
  LANES,
  APPROACH_BEATS,
  GOOD_MS,
  beatMs,
  buildChart,
  timeChart,
  judgeTap,
  sweepMisses,
  scoreFor,
  summarize,
  stars,
  comboCheer,
  songEndMs,
  noteY,
  laneAt,
  resultLine,
} from './dance/engine.js'
import './dance/dance.css'

// Lane colors are fixed (theme confetti includes white, which would vanish on
// the white note discs). Everything else on stage reads from the theme.
const LANE_COLORS = ['#f472b6', '#facc15', '#a78bfa', '#38bdf8']
const NOTE_SIZE = 72
const HIT_BOTTOM = 60 // px from the stage bottom to the target-ring center
const MOVE_CLASSES = [...MOVES.map((m) => `dance-move-${m.id}`), 'dance-move-oops']
const FREE = { id: 'free', name: 'ריקוד חופשי', emoji: '🕺', he: 'רוקדים איך שבא לך!' }
const STALL_MS = 300 // audio clock frozen this long → keep dancing on the wall clock

/**
 * Beat clock: ms since beat 0. Follows the AudioContext clock the music is
 * scheduled on so notes line up with what she hears; without music (muted, no
 * WebAudio) it runs on performance.now(). If the audio clock stops advancing
 * (context suspended by autoplay policy or an OS audio interruption) it
 * carries on from the same position on the wall clock instead of freezing.
 */
function makeClock(audio) {
  const wall = () => performance.now()
  if (!audio) {
    const start = wall() + 100
    return { silent: true, nowMs: () => wall() - start }
  }
  let lastAudio = audio.now()
  let stalledSince = 0
  let offset = null // set once we give up on the audio clock
  return {
    silent: false,
    nowMs() {
      const w = wall()
      if (offset !== null) return w + offset
      const a = audio.now()
      const ms = (a - audio.startTime) * 1000
      if (a !== lastAudio) {
        lastAudio = a
        stalledSince = 0
        return ms
      }
      if (!stalledSince) stalledSince = w
      else if (w - stalledSince > STALL_MS) offset = ms - w
      return ms
    },
  }
}

export default function Dance({ onClose }) {
  const { state, dispatch } = usePlayer()
  const { theme } = useTheme()
  const [phase, setPhase] = useState('pick') // 'pick' | 'play' | 'result'
  const [song, setSong] = useState(null)
  const [mode, setMode] = useState('rhythm') // 'rhythm' | 'free'
  const [run, setRun] = useState(0)
  const [result, setResult] = useState(null)
  const best = state.arcadeHighScores.dance || 0

  // the lobby tune comes back whenever the overlay goes away (no-op when muted)
  useEffect(() => () => playMusic('lobby'), [])

  const start = (s, m) => {
    sfx.click()
    setSong(s)
    setMode(m)
    setResult(null)
    setRun((r) => r + 1)
    setPhase('play')
  }

  const finish = (summary) => {
    const isRecord = summary.score > best
    if (summary.score > 0) dispatch({ type: 'ARCADE_SCORE', game: 'dance', score: summary.score })
    setResult({ ...summary, stars: stars(summary.hits, summary.total), isRecord, best: Math.max(best, summary.score) })
    setPhase('result')
    playMusic('lobby')
  }

  // Portaled to <body>: the World tab sits inside App's `relative z-10`
  // content wrapper, and the sidebar / bottom nav (z-20) would paint over a
  // fixed overlay rendered in there. Theme vars come inline from the app root,
  // so they are re-applied here.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-(--t-side-deep) font-sans text-slate-800 select-none"
      style={theme.vars}
      data-theme={theme.id}
      dir="rtl"
    >
      {phase === 'pick' ? (
        <SongPicker onPick={start} onClose={onClose} />
      ) : (
        <DanceStage key={run} song={song} mode={mode} onFinish={finish} onClose={onClose} />
      )}
      {phase === 'result' && result && (
        <ResultCard result={result} onAgain={() => start(song, mode)} onOther={() => setPhase('pick')} onClose={onClose} />
      )}
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------------ */
/* chrome                                                                    */
/* ------------------------------------------------------------------------ */

function TopBar({ onClose, title, score, combo = 0 }) {
  return (
    <div className="relative z-10 flex items-center gap-3 px-3 py-2 bg-(--t-side) border-b-4 border-(--t-side-deep) shrink-0">
      <button
        onClick={onClose}
        aria-label="יציאה"
        className="w-16 h-16 shrink-0 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-2xl flex items-center justify-center transition-all"
      >
        <X size={30} strokeWidth={3} />
      </button>
      <div className="flex-1 text-center leading-tight min-w-0">
        <div className="text-(--t-text-soft) font-bold text-sm truncate">{title}</div>
        {score === null ? (
          <div className="text-(--t-accent) font-black text-2xl">🎶</div>
        ) : (
          <div className="text-(--t-accent) font-black text-3xl tabular-nums drop-shadow">{score}</div>
        )}
      </div>
      <div className="w-16 shrink-0 flex justify-center" aria-live="off">
        {combo >= 2 && (
          <span
            key={combo}
            className="anim-streak-pop bg-orange-500 border-2 border-orange-300 text-white font-black rounded-xl px-2 py-1 text-lg tabular-nums rotate-2 shadow-md"
          >
            🔥{combo}
          </span>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* song picker                                                               */
/* ------------------------------------------------------------------------ */

function SongPicker({ onPick, onClose }) {
  useEffect(() => {
    speak('איזה שיר לרקוד?', { delay: 700 })
  }, [])

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <TopBar onClose={onClose} title="💃 ריקוד" score={null} />
      <div className="relative flex-1 overflow-hidden">
        <ArcadeBackdrop />
        <div className="dance-spot" />
        <div className="absolute inset-0 overflow-y-auto p-4 md:p-6">
          <div className="max-w-3xl mx-auto flex flex-col items-center gap-4 md:gap-6">
            <div className="flex items-end gap-4 md:gap-8">
              <div className="h-40 md:h-52 shrink-0">
                <Avatar size={208} className="anim-float-bob" />
              </div>
              <div className="pb-4">
                <h2 className="text-3xl md:text-4xl font-black text-white drop-shadow-md leading-tight">איזה שיר לרקוד?</h2>
                <button
                  onClick={() => speak('איזה שיר לרקוד?')}
                  aria-label="הקראה"
                  className="mt-2 text-(--t-text-soft) font-bold text-lg bg-black/20 rounded-xl px-3 py-1"
                >
                  🔊 בוחרים שיר
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4 w-full">
              {DANCE_SONGS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onPick(s, 'rhythm')}
                  className="bg-white/95 rounded-3xl border-b-8 border-(--t-accent-deep) p-4 min-h-40 flex flex-col items-center justify-center gap-2 shadow-xl hover:-translate-y-1 active:translate-y-1 active:border-b-2 transition-all"
                >
                  <span className="text-6xl md:text-7xl drop-shadow">{s.emoji}</span>
                  <span className="font-black text-slate-800 text-xl md:text-2xl leading-tight">{s.name}</span>
                  <span className="text-slate-500 font-bold text-sm">🎵 רוקדים לפי הקצב</span>
                </button>
              ))}
              <button
                onClick={() => onPick(DANCE_SONGS[Math.floor(Math.random() * DANCE_SONGS.length)], 'free')}
                className="rounded-3xl border-b-8 border-fuchsia-800 bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white p-4 min-h-40 flex flex-col items-center justify-center gap-2 shadow-xl hover:-translate-y-1 active:translate-y-1 active:border-b-2 transition-all"
              >
                <span className="text-6xl md:text-7xl drop-shadow">{FREE.emoji}</span>
                <span className="font-black text-xl md:text-2xl leading-tight drop-shadow">{FREE.name}</span>
                <span className="text-white/85 font-bold text-sm">{FREE.he}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* stage                                                                     */
/* ------------------------------------------------------------------------ */

// 2 × 8 color tiles under the doll; the lit checkerboard flips every beat
const DanceFloor = memo(function DanceFloor({ beat, colors }) {
  const tiles = []
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 8; c++) {
      const lit = beat >= 0 && (r + c + beat) % 2 === 0
      tiles.push(
        <div key={`${r}-${c}`} className={`dance-tile${lit ? ' lit' : ''}`} style={{ background: colors[(r * 3 + c) % colors.length] }} />,
      )
    }
  }
  return (
    <div className="dance-floor" aria-hidden="true">
      {tiles}
    </div>
  )
})

function MoveButtons({ onTap }) {
  return (
    <div
      className="shrink-0 grid grid-cols-4 gap-2 p-2 bg-(--t-side) border-t-4 border-(--t-side-deep) touch-none"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      {MOVES.map((m, i) => (
        <button
          key={m.id}
          type="button"
          onPointerDown={(e) => {
            e.preventDefault()
            onTap(i)
          }}
          aria-label={m.name}
          className="min-h-24 rounded-2xl bg-white/95 border-b-8 flex flex-col items-center justify-center gap-1 shadow-md active:translate-y-1 active:border-b-2 transition-transform select-none"
          style={{ borderColor: LANE_COLORS[i] }}
        >
          <span className="text-4xl md:text-5xl leading-none drop-shadow-sm">{m.emoji}</span>
          <span className="font-black text-slate-700 text-sm md:text-lg leading-tight">{m.name}</span>
        </button>
      ))}
    </div>
  )
}

function DanceStage({ song, mode, onFinish, onClose }) {
  const { theme } = useTheme()
  const rhythm = mode === 'rhythm'
  const stageRef = useRef(null)
  const dollRef = useRef(null)
  const burstRef = useRef(null)
  const noteEls = useRef([])
  const g = useRef(null) // hot game state — mutated from the rAF loop and taps
  const idRef = useRef(0)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish

  const [notes] = useState(() =>
    rhythm ? timeChart(buildChart({ beats: song.beats, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 }), song.bpm) : [],
  )
  const [hud, setHud] = useState({ score: 0, combo: 0 })
  const [beat, setBeat] = useState(-1)
  const [judgement, setJudgement] = useState(null) // { id, text, lane, kind }
  const [cheer, setCheer] = useState(null) // { id, text }
  const bm = beatMs(song.bpm)

  // the note layer renders once; the loop writes transforms straight to the DOM
  const noteLayer = useMemo(
    () =>
      notes.map((n, i) => (
        <span
          key={i}
          ref={(el) => {
            noteEls.current[i] = el
          }}
          className="dance-note"
          style={{ right: `calc(${(n.lane + 0.5) * 25}% - ${NOTE_SIZE / 2}px)`, color: LANE_COLORS[n.lane] }}
        >
          {MOVES[n.lane].emoji}
        </span>
      )),
    [notes],
  )

  const playMove = (id) => {
    const el = dollRef.current
    if (!el) return
    el.classList.remove(...MOVE_CLASSES)
    void el.offsetWidth // restart the animation even when the same move repeats
    el.classList.add(`dance-move-${id}`)
  }

  // theme confetti + particles flying out of (cx, cy) in stage pixels
  const burstAt = (cx, cy, count) => {
    const layer = burstRef.current
    if (!layer) return
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span')
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.6
      const dist = 60 + Math.random() * 80
      p.className = 'dance-burst'
      p.textContent = i % 3 === 0 ? theme.particles[i % theme.particles.length] : '●'
      p.style.color = theme.confetti[i % theme.confetti.length]
      p.style.left = `${cx - 11}px`
      p.style.top = `${cy - 11}px`
      p.style.setProperty('--dx', `${(Math.cos(ang) * dist).toFixed(0)}px`)
      p.style.setProperty('--dy', `${(Math.sin(ang) * dist - 40).toFixed(0)}px`)
      p.style.setProperty('--rot', `${Math.round(Math.random() * 360 - 180)}deg`)
      p.addEventListener('animationend', () => p.remove(), { once: true })
      setTimeout(() => p.remove(), 1000) // reduced-motion hides it, so animationend never fires
      layer.appendChild(p)
    }
  }

  const laneCenter = (lane) => {
    const stage = stageRef.current
    return stage ? stage.clientWidth * (1 - (lane + 0.5) / LANES) : 0
  }

  const showJudgement = (text, lane, kind) => setJudgement({ id: ++idRef.current, text, lane, kind })

  const miss = (indices) => {
    const s = g.current
    for (const i of indices) s.notes[i].result = 'miss'
    s.combo = 0
    playMove('oops')
    sfx.buzz()
    setHud({ score: s.score, combo: 0 })
    showJudgement('אופס', s.notes[indices[0]].lane, 'miss')
  }

  const tap = (lane) => {
    const s = g.current
    if (!s || s.done) return
    playMove(MOVES[lane].id)
    const stage = stageRef.current
    if (!rhythm) {
      sfx.pop()
      if (stage) burstAt(stage.clientWidth / 2, stage.clientHeight * 0.55, 10)
      return
    }
    const hit = judgeTap(s.notes, lane, s.clock.nowMs())
    if (!hit) {
      sfx.click() // nothing nearby — she just dances, nothing lost
      return
    }
    s.notes[hit.index].result = hit.judgement
    s.score += scoreFor(hit.judgement)
    s.combo += 1
    const el = noteEls.current[hit.index]
    if (el) el.style.visibility = 'hidden'
    if (stage) burstAt(laneCenter(lane), stage.clientHeight - HIT_BOTTOM, hit.judgement === 'perfect' ? 14 : 8)
    if (hit.judgement === 'perfect') sfx.ding()
    else sfx.pop()
    showJudgement(hit.judgement === 'perfect' ? 'מושלם! ✨' : 'יופי! 👍', lane, hit.judgement)
    const line = comboCheer(s.combo)
    if (line) {
      speak(line)
      setCheer({ id: ++idRef.current, text: line })
    }
    setHud({ score: s.score, combo: s.combo })
  }

  const onStagePointer = (e) => {
    const stage = stageRef.current
    if (!stage) return
    if (!rhythm) {
      tap(Math.floor(Math.random() * LANES))
      return
    }
    const rect = stage.getBoundingClientRect()
    tap(laneAt(rect.right - e.clientX, rect.width))
  }

  useEffect(() => {
    playMusic(song.id, { restart: true })
    const audio = getBeatClock()
    const clock = makeClock(audio && audio.name === song.id ? audio : null)
    const { silent } = clock
    const approachMs = APPROACH_BEATS * bm
    const endMs = rhythm ? songEndMs(notes, song.bpm, song.beats) : Infinity
    const s = { clock, notes, score: 0, combo: 0, lastBeat: -1, done: false, raf: 0 }
    g.current = s
    speak(rhythm ? `${song.name}! רוקדים!` : 'ריקוד חופשי! רוקדים!')
    setCheer({ id: ++idRef.current, text: 'רוקדים!' })

    const loop = () => {
      if (s.done) return
      const nowMs = clock.nowMs()
      const b = Math.floor(nowMs / bm)
      if (b >= 0 && b !== s.lastBeat) {
        s.lastBeat = b
        setBeat(b)
        if (silent) sfx.click() // metronome when the music is off
      }
      if (rhythm) {
        const stage = stageRef.current
        if (stage) {
          const hitY = stage.clientHeight - HIT_BOTTOM - NOTE_SIZE / 2
          const spawnY = -NOTE_SIZE
          for (let i = 0; i < notes.length; i++) {
            const el = noteEls.current[i]
            if (!el) continue
            const n = notes[i]
            const dt = n.timeMs - nowMs
            if (n.result || dt > approachMs || dt < -GOOD_MS) {
              if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden'
              continue
            }
            el.style.visibility = 'visible'
            el.style.transform = `translateY(${noteY(n.timeMs, nowMs, approachMs, spawnY, hitY).toFixed(1)}px)`
          }
        }
        const missed = sweepMisses(notes, nowMs)
        if (missed.length) miss(missed)
        if (nowMs >= endMs) {
          s.done = true
          finishRef.current(summarize(notes))
          return
        }
      }
      s.raf = requestAnimationFrame(loop)
    }
    s.raf = requestAnimationFrame(loop)
    return () => {
      s.done = true
      cancelAnimationFrame(s.raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <TopBar onClose={onClose} title={rhythm ? `${song.emoji} ${song.name}` : `${FREE.emoji} ${FREE.name}`} score={rhythm ? hud.score : null} combo={hud.combo} />

      <div ref={stageRef} className="relative flex-1 overflow-hidden touch-none" onPointerDown={onStagePointer}>
        <ArcadeBackdrop />
        <div className="dance-spot" />
        <DanceFloor beat={beat} colors={theme.confetti} />

        {/* the doll — idle bounce on the outer wrapper, moves on the inner one */}
        <div className="dance-doll-stage absolute inset-x-0 flex justify-center pointer-events-none" style={{ bottom: '13%', height: '54%' }}>
          <div className="dance-doll dance-idle h-full" style={{ '--beat': `${bm}ms` }}>
            <div ref={dollRef} className="dance-doll-move h-full" onAnimationEnd={(e) => e.currentTarget.classList.remove(...MOVE_CLASSES)}>
              <Avatar size={340} />
            </div>
          </div>
        </div>

        {rhythm && (
          <>
            {MOVES.map((m, i) => (
              <div key={m.id} className="dance-lane" style={{ right: `${i * 25}%` }} />
            ))}
            {MOVES.map((m, i) => (
              <div
                key={m.id}
                className={`dance-target${beat >= 0 && beat % 2 === 0 ? ' lit' : ''}`}
                style={{ right: `calc(${(i + 0.5) * 25}% - 42px)`, bottom: HIT_BOTTOM - 42, borderColor: LANE_COLORS[i] }}
              />
            ))}
            {noteLayer}
          </>
        )}

        <div ref={burstRef} className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true" />

        {judgement && (
          <span
            key={judgement.id}
            className={`dance-judge font-black text-3xl md:text-4xl drop-shadow-md ${
              judgement.kind === 'perfect' ? 'text-yellow-300' : judgement.kind === 'good' ? 'text-white' : 'text-white/70'
            }`}
            style={{ right: `${(judgement.lane + 0.5) * 25}%`, bottom: HIT_BOTTOM + 60 }}
          >
            {judgement.text}
          </span>
        )}

        {cheer && (
          <div key={cheer.id} className="absolute inset-x-0 top-[8%] text-center pointer-events-none">
            <span className="dance-cheer inline-block bg-white/95 text-pink-600 font-black text-3xl md:text-4xl px-6 py-2 rounded-3xl border-b-8 border-pink-300 shadow-xl">
              {cheer.text} 🎉
            </span>
          </div>
        )}
      </div>

      <MoveButtons onTap={tap} />
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* result                                                                    */
/* ------------------------------------------------------------------------ */

function ResultCard({ result, onAgain, onOther, onClose }) {
  useEffect(() => {
    if (result.isRecord || result.stars === 3) sfx.fanfare()
    else sfx.coin()
    speak(resultLine(result.stars, result.isRecord), { delay: 500 })
  }, [result])

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-(--t-overlay) backdrop-blur-sm p-4">
      <div className="anim-zoom-in bg-white rounded-3xl border-8 border-(--t-side-deep) shadow-2xl w-full max-w-sm overflow-hidden text-center">
        <div className="p-5 bg-gradient-to-br from-(--t-bg-from) to-(--t-bg-to) border-b-8 border-black/10">
          <div className="flex justify-center gap-2 mb-2" aria-label={`${result.stars} כוכבים`}>
            {[0, 1, 2].map((i) => (
              <Star
                key={i}
                size={56}
                strokeWidth={2.5}
                className={`dance-star drop-shadow-md ${i < result.stars ? 'text-yellow-300 fill-yellow-300' : 'text-white/40 fill-white/15'}`}
                style={{ animationDelay: `${0.15 + i * 0.25}s` }}
              />
            ))}
          </div>
          <h2 className="text-3xl font-black text-white drop-shadow-md">{result.isRecord ? 'שיא חדש! 🏆' : 'כל הכבוד! 💃'}</h2>
        </div>
        <div className="p-6 flex flex-col items-center gap-3 bg-slate-50">
          <p className="text-5xl font-black text-slate-800 tabular-nums">{result.score}</p>
          <div className="flex items-center gap-4 text-slate-500 font-bold tabular-nums">
            <span>✨ {result.perfect}</span>
            <span>👍 {result.good}</span>
            <span>💤 {result.miss}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 font-bold">
            <Trophy size={18} className="text-yellow-500 fill-yellow-200" />
            <span className="tabular-nums">שיא: {result.best}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full mt-1">
            <button
              onClick={onAgain}
              className="min-h-16 bg-pink-500 hover:bg-pink-400 text-white text-xl font-black rounded-2xl border-b-8 border-pink-700 active:border-b-0 active:translate-y-2 transition-all"
            >
              עוד פעם 🔁
            </button>
            <button
              onClick={onOther}
              className="min-h-16 bg-violet-500 hover:bg-violet-400 text-white text-xl font-black rounded-2xl border-b-8 border-violet-700 active:border-b-0 active:translate-y-2 transition-all"
            >
              שיר אחר 🎵
            </button>
            <button
              onClick={onClose}
              className="col-span-2 min-h-14 bg-slate-200 hover:bg-slate-300 text-slate-700 text-lg font-black rounded-2xl border-b-8 border-slate-400 active:border-b-0 active:translate-y-2 transition-all"
            >
              יציאה
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
