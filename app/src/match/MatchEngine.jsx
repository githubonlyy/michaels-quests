import { useEffect, useRef, useState } from 'react'
import { X, Coins, Trophy, Star, Sparkles, ChevronUp, Flame, Volume2, VolumeX } from 'lucide-react'
import { sfx, isMuted, setMuted } from './sounds.js'
import { speak, stopSpeaking } from './speak.js'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { MODES } from '../data/events.js'
import { TROPHIES } from '../data/trophies.js'
import lettersQ from '../data/questions/letters.json'
import colorsQ from '../data/questions/colors.json'
import countingQ from '../data/questions/counting.json'
import matchQ from '../data/questions/match.json'
import shapesQ from '../data/questions/shapes.json'
import compareQ from '../data/questions/compare.json'
import NumberPad from './widgets/NumberPad.jsx'
import BigTiles from './widgets/BigTiles.jsx'
import TwoChoice from './widgets/TwoChoice.jsx'
import CountObjects, { EmojiGrid } from './widgets/CountObjects.jsx'
import BalloonPop from './widgets/BalloonPop.jsx'
import PairsBoard from './PairsBoard.jsx'
import VaultReveal from './VaultReveal.jsx'

const BANKS = {
  letters: lettersQ, colors: colorsQ, counting: countingQ,
  match: matchQ, shapes: shapesQ, compare: compareQ,
}
const WIDGETS = {
  bigtiles: BigTiles, countobjects: CountObjects, numberpad: NumberPad, twochoice: TwoChoice,
}

const CHEERS = ['מעולה!', 'כל הכבוד!', 'יופי!', 'וואו, נכון!', 'אלוף!', 'בדיוק!']
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const sample = (bank, n) => shuffle(bank).slice(0, Math.min(n, bank.length))

/* ---------------------------------------------------------------------------
 * Prepared question format (what the engine hands to widgets):
 *   {
 *     prompt: string|null,          // Hebrew heading on the card
 *     display: { kind: 'hear' | 'emoji' | 'seq' | 'count', ... } | null,
 *     speak: string,                // spoken on mount + 🔊
 *     answerSpeak: string,          // spoken form of the answer ("לא נורא, התשובה היא …")
 *     answerText: string,           // shown in the feedback bar
 *     // widget payload — exactly one of:
 *     tiles: [{ id, kind: 'text'|'emoji'|'shape'|'color', value, correct }]  // BigTiles
 *     options: [{ label, correct }]                                    // BalloonPop
 *     a: string                                                        // NumberPad (math)
 *     emoji, n                                                         // CountObjects
 *     panels: [{ id: 'left'|'right', kind: 'count'|'number', ..., correct }] // TwoChoice
 *   }
 * ------------------------------------------------------------------------- */

const tilesFrom = (options, answer, kind) =>
  shuffle(options).map((v, i) => ({ id: i, kind, value: v, correct: v === answer }))

function buildClassic(eventId, q, bank) {
  switch (eventId) {
    case 'letters': {
      const tiles = tilesFrom(q.options, q.letter, 'text')
      return q.kind === 'hear'
        ? { prompt: 'איזו אות שמעת?', display: { kind: 'hear' }, speak: q.speak, answerSpeak: q.answerSpeak, answerText: q.letter, tiles }
        : { prompt: 'באיזו אות מתחילה המילה?', display: { kind: 'emoji', value: q.emoji }, speak: q.speak, answerSpeak: q.answerSpeak, answerText: q.letter, tiles }
    }
    case 'colors': {
      const tiles = tilesFrom(q.options, q.ask, 'color')
      return {
        prompt: q.speak,
        display: q.emoji ? { kind: 'emoji', value: q.emoji } : null,
        speak: q.speak,
        answerSpeak: q.answerSpeak,
        answerText: q.name,
        tiles,
      }
    }
    case 'match': {
      const others = shuffle(bank.filter((x) => x.match !== q.match)).slice(0, 3)
      return {
        prompt: q.speak,
        display: { kind: 'emoji', value: q.emoji },
        speak: q.speak,
        answerSpeak: q.answerSpeak,
        answerText: q.match,
        tiles: tilesFrom([q.match, ...others.map((o) => o.match)], q.match, 'emoji'),
      }
    }
    case 'counting':
      return { prompt: 'כמה יש כאן?', display: null, speak: q.speak, answerSpeak: q.answerSpeak, answerText: String(q.n), emoji: q.emoji, n: q.n }
    case 'shapes':
      return q.kind === 'shape'
        ? { prompt: q.speak, display: null, speak: q.speak, answerSpeak: q.answerSpeak, answerText: q.answerSpeak, tiles: tilesFrom(q.options, q.ask, 'shape') }
        : { prompt: 'מה בא אחר כך?', display: { kind: 'seq', value: q.seq }, speak: q.speak, answerSpeak: q.answerSpeak, answerText: q.answer, tiles: tilesFrom(q.options, q.answer, 'emoji') }
    case 'compare': {
      const leftWins = q.kind === 'count'
        ? (q.ask === 'more') === (q.left.n > q.right.n)
        : (q.ask === 'bigger') === (q.a > q.b)
      const side = leftWins ? 'left' : 'right'
      const panels = q.kind === 'count'
        ? [
            { id: 'left', kind: 'count', emoji: q.left.emoji, n: q.left.n },
            { id: 'right', kind: 'count', emoji: q.right.emoji, n: q.right.n },
          ]
        : [
            { id: 'left', kind: 'number', value: q.a },
            { id: 'right', kind: 'number', value: q.b },
          ]
      for (const p of panels) p.correct = p.id === side
      const answerText = q.kind === 'number' ? String(leftWins ? q.a : q.b) : leftWins ? 'בצד שמאל' : 'בצד ימין'
      return { prompt: q.speak, display: null, speak: q.speak, answerSpeak: q.answerSpeak, answerText, panels }
    }
    default:
      return null
  }
}

/* ---- balloon mode: 4 floating options ---- */
function numberDecoys(answer, lo, hi) {
  const a = Number(answer)
  const pool = new Set()
  for (const d of shuffle([1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 10, -10])) {
    const c = a + d
    if (c >= lo && c <= hi) pool.add(String(c))
    if (pool.size === 3) break
  }
  return [...pool]
}
const balloonOptions = (correct, decoys) =>
  shuffle([{ label: correct, correct: true }, ...decoys.map((d) => ({ label: d, correct: false }))])

function buildBalloon(eventId, q, bank) {
  if (eventId === 'letters') {
    const { tiles: _tiles, ...base } = buildClassic('letters', q, bank)
    return { ...base, options: balloonOptions(q.letter, q.options.filter((o) => o !== q.letter)) }
  }
  // counting
  return {
    prompt: 'כמה יש כאן?',
    display: { kind: 'count', emoji: q.emoji, n: q.n },
    speak: q.speak,
    answerSpeak: q.answerSpeak,
    answerText: String(q.n),
    options: balloonOptions(String(q.n), numberDecoys(q.n, 1, 10)),
  }
}

/* ---- pairs mode: picture pairs (🐮 ↔ 🥛) from the match bank ---- */
function buildPairs(eventId, count) {
  return sample(matchQ, count).map((q, i) => ({ id: i, a: q.emoji, b: q.match }))
}

/* ---- the big visual under the prompt ---- */
function PromptDisplay({ display, onRepeat }) {
  if (!display) return null
  switch (display.kind) {
    case 'hear':
      return (
        <button
          onClick={onRepeat}
          aria-label="להשמיע שוב"
          className="w-28 h-28 md:w-36 md:h-36 short:w-20 short:h-20 rounded-full bg-(--t-accent-deep) border-b-8 border-(--t-side) shadow-xl text-6xl md:text-7xl short:text-4xl flex items-center justify-center active:translate-y-2 active:border-b-0 transition-all anim-float-bob"
        >
          🔊
        </button>
      )
    case 'emoji':
      return <span className="text-8xl md:text-9xl short:text-6xl leading-none select-none">{display.value}</span>
    case 'seq':
      return (
        <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap bg-amber-50 border-4 border-amber-200 rounded-3xl px-4 py-3" dir="rtl">
          {display.value.map((e, i) => (
            <span key={i} className="text-5xl md:text-6xl short:text-3xl leading-none">{e}</span>
          ))}
          <span className="w-14 h-14 md:w-16 md:h-16 rounded-2xl border-4 border-dashed border-amber-400 bg-white flex items-center justify-center text-3xl font-black text-amber-500">
            ?
          </span>
        </div>
      )
    case 'count':
      return (
        <div className="bg-sky-50 border-4 border-sky-200 rounded-3xl px-4 py-3 md:px-6 md:py-4 shadow-inner">
          <EmojiGrid emoji={display.emoji} n={display.n} />
        </div>
      )
    default:
      return null
  }
}

const RESULT_UI = {
  WIN: { title: 'ניצחון!', speak: 'ניצחון! כל הכבוד מיכאל!', grad: 'bg-gradient-to-br from-amber-400 to-orange-600' },
  DRAW: { title: 'יפה מאוד!', speak: 'יפה מאוד!', grad: 'bg-gradient-to-br from-indigo-400 to-indigo-600' },
  LOSS: { title: 'כמעט! ננסה שוב', speak: 'כמעט! ננסה שוב', grad: 'bg-gradient-to-br from-sky-400 to-sky-600' },
}

export default function MatchEngine({ event, mode = 'classic', practice, onExit, onPlayAgain }) {
  const { state, dispatch, config } = usePlayer()
  const { theme } = useTheme()
  const N = config.questionsPerMatch
  const isPairs = mode === 'pairs'
  const isBalloon = mode === 'balloon'
  const hasTimer = config.questionTimerSec > 0

  const [questions] = useState(() => {
    if (isPairs) return []
    const bank = BANKS[event.id]
    return sample(bank, N).map((q) => (isBalloon ? buildBalloon(event.id, q, bank) : buildClassic(event.id, q, bank)))
  })
  const [pairsData] = useState(() => (isPairs ? buildPairs(event.id, config.pairs.pairCount) : null))

  const [qIndex, setQIndex] = useState(0)
  const [phase, setPhase] = useState(isPairs ? 'board' : 'ask') // ask | fxwait | feedback | board | results
  const [remaining, setRemaining] = useState(config.questionTimerSec)
  const [feedback, setFeedback] = useState(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [coinsEarned, setCoinsEarned] = useState(0)
  const [pairsOutcome, setPairsOutcome] = useState(null)
  const [revealDone, setRevealDone] = useState(false)
  const [streak, setStreak] = useState(0)
  const [muted, setMutedState] = useState(isMuted())

  const toggleMute = () => {
    setMuted(!muted)
    setMutedState(!muted)
  }

  const qStartRef = useRef(Date.now())
  const totalTimeRef = useRef(0)
  const reportedRef = useRef(false)
  const startLevelRef = useRef(state.level)
  const startTrophiesRef = useRef(Object.keys(state.trophies ?? {}))

  const total = questions.length
  const question = questions[qIndex]
  const Widget = isBalloon ? BalloonPop : WIDGETS[event.widget]

  const repeatPrompt = () => question && speak(question.speak)

  // every prompt is read aloud when it appears (she can't read yet)
  useEffect(() => {
    if (phase !== 'ask' || !question) return
    qStartRef.current = Date.now()
    speak(question.speak, { delay: 350 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qIndex])

  // leaving the match silences any half-spoken line
  useEffect(() => () => stopSpeaking(), [])

  // optional per-question countdown — off for first grade (questionTimerSec 0)
  useEffect(() => {
    if (!hasTimer || phase !== 'ask') return
    setRemaining(config.questionTimerSec)
    const interval = setInterval(() => {
      const elapsed = (Date.now() - qStartRef.current) / 1000
      const left = config.questionTimerSec - elapsed
      if (left <= 0) {
        clearInterval(interval)
        handleAnswer(false, true)
      } else {
        setRemaining(left)
      }
    }, 100)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qIndex])

  // fxDelay: widget is playing its own effect (pop, jump...) — the answer is
  // locked in NOW, the feedback overlay appears after the fx finishes.
  function handleAnswer(isCorrect, timedOut = false, fxDelay = 0) {
    if (phase !== 'ask') return
    const elapsed = timedOut ? config.questionTimerSec : (Date.now() - qStartRef.current) / 1000
    totalTimeRef.current += elapsed

    let gained = 0
    if (isCorrect) {
      const fast = config.speedBonusCoins > 0 && config.speedThresholdSec > 0 && elapsed < config.speedThresholdSec
      gained = config.coinsPerCorrect + (fast ? config.speedBonusCoins : 0)
      setCorrectCount((c) => c + 1)
      setCoinsEarned((c) => c + gained)
      setStreak((s) => s + 1)
    } else {
      setStreak(0)
    }

    const cheer = pick(CHEERS)
    const showFeedback = () => {
      if (!isBalloon) (isCorrect ? sfx.ding : sfx.buzz)() // balloon pops/buzzes itself
      speak(isCorrect ? cheer : `לא נורא, התשובה היא ${question.answerSpeak}`, { delay: 150 })
      setFeedback({ correct: isCorrect, gained, timedOut, cheer })
      setPhase('feedback')
    }
    if (fxDelay > 0) {
      setPhase('fxwait')
      setTimeout(showFeedback, fxDelay)
    } else {
      showFeedback()
    }
  }

  // feedback pause (long enough to hear the answer), then advance
  useEffect(() => {
    if (phase !== 'feedback') return
    const timer = setTimeout(() => {
      setFeedback(null)
      if (qIndex + 1 < total) {
        setQIndex((i) => i + 1)
        setPhase('ask')
      } else {
        setPhase('results')
      }
    }, feedback?.correct ? 1400 : 2800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function handleBoardFinish({ pairs, wrongFlips, elapsedSec, timedOut }) {
    const pcfg = config.pairs
    const complete = pairs === pcfg.pairCount
    const win = complete && !timedOut && wrongFlips <= pcfg.maxWrongForWin
    const resultLabel = win ? 'WIN' : complete ? 'DRAW' : 'LOSS'
    setPairsOutcome({
      correct: pairs,
      total: pcfg.pairCount,
      coins: pairs * pcfg.coinsPerPair + (win ? config.winBonusCoins : 0),
      xp: pairs * pcfg.xpPerPair,
      resultLabel,
      avgTimeSec: Math.round((elapsedSec / Math.max(1, pairs)) * 10) / 10,
    })
    setPhase('results')
  }

  /* ---- unified result values across modes ---- */
  const qIsWin = correctCount >= config.winThreshold
  const qIsDraw = !qIsWin && correctCount >= config.drawThreshold
  const unified = isPairs && pairsOutcome
    ? {
        correct: pairsOutcome.correct,
        totalUnits: pairsOutcome.total,
        resultLabel: pairsOutcome.resultLabel,
        finalCoins: pairsOutcome.coins,
        xpEarned: pairsOutcome.xp,
        avgTimeSec: pairsOutcome.avgTimeSec,
      }
    : {
        correct: correctCount,
        totalUnits: total,
        resultLabel: qIsWin ? 'WIN' : qIsDraw ? 'DRAW' : 'LOSS',
        finalCoins: coinsEarned + (qIsWin ? config.winBonusCoins : 0),
        xpEarned: correctCount * config.xpPerCorrect,
        avgTimeSec: Math.round((totalTimeRef.current / Math.max(1, total)) * 10) / 10,
      }
  const isWin = unified.resultLabel === 'WIN'
  const isDraw = unified.resultLabel === 'DRAW'
  const resultUi = RESULT_UI[unified.resultLabel]

  // report result exactly once
  useEffect(() => {
    if (phase !== 'results' || reportedRef.current) return
    reportedRef.current = true
    if (isWin) sfx.fanfare()
    speak(`${resultUi.speak} ${unified.correct} מתוך ${unified.totalUnits} ${isPairs ? 'זוגות' : 'נכונות'}`, { delay: 500 })
    dispatch({
      type: 'MATCH_RESULT',
      eventId: event.id,
      subject: event.title,
      result: unified.resultLabel,
      correct: unified.correct,
      total: unified.totalUnits,
      coinsEarned: unified.finalCoins,
      xpEarned: unified.xpEarned,
      avgTimeSec: unified.avgTimeSec,
      practice,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const leveledUp = state.level > startLevelRef.current
  const newTrophies = Object.keys(state.trophies ?? {})
    .filter((id) => !startTrophiesRef.current.includes(id))
    .map((id) => TROPHIES.find((t) => t.id === id))
    .filter(Boolean)
  const timerPct = hasTimer ? (remaining / config.questionTimerSec) * 100 : 100

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-(--t-overlay) backdrop-blur-sm" dir="rtl">
      {phase !== 'results' && (
        <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-3 md:p-6 short:p-1.5" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {/* top bar */}
          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4 short:mb-1">
            <button
              onClick={onExit}
              aria-label="יציאה"
              className="w-12 h-12 bg-white/15 hover:bg-white/25 text-white rounded-full flex items-center justify-center transition-colors shrink-0"
            >
              <X size={24} strokeWidth={3} />
            </button>
            {!isPairs && (
              <>
                <div className="flex-1 flex gap-1.5">
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      className={`h-3 flex-1 rounded-full ${
                        i < qIndex ? 'bg-yellow-400' : i === qIndex ? 'bg-white' : 'bg-white/20'
                      }`}
                    ></div>
                  ))}
                </div>
                <span className="text-white font-black text-lg shrink-0 tabular-nums" dir="ltr">{qIndex + 1}/{total}</span>
                <button
                  onClick={repeatPrompt}
                  aria-label="להשמיע שוב"
                  className="w-12 h-12 bg-(--t-accent-deep) hover:brightness-110 rounded-full flex items-center justify-center text-2xl shrink-0 shadow-md border-b-4 border-(--t-side) active:border-b-0 active:translate-y-1 transition-all"
                >
                  🔊
                </button>
              </>
            )}
            {isPairs && (
              <span className="flex-1 text-white font-black text-lg tracking-wide">{MODES.pairs.label} · {event.title}</span>
            )}
            {!isPairs && streak >= 3 && (
              <span key={streak} className="anim-streak-pop flex items-center gap-1 bg-orange-500 text-white text-sm font-black px-2.5 py-1 rounded-full border-2 border-orange-300 shrink-0" dir="ltr">
                <Flame size={16} className="fill-yellow-300 text-yellow-200" /> x{streak}
              </span>
            )}
            {practice && (
              <span className="bg-blue-500 text-white text-xs font-black px-3 py-1 rounded-full border-2 border-blue-300 shrink-0">
                אימון
              </span>
            )}
            <button
              onClick={toggleMute}
              className="w-12 h-12 bg-white/15 hover:bg-white/25 text-white rounded-full flex items-center justify-center transition-colors shrink-0"
              aria-label={muted ? 'הפעלת צלילים' : 'השתקת צלילים'}
            >
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>

          {/* per-question timer — only when the config asks for one */}
          {!isPairs && hasTimer && (
            <div className="h-4 bg-black/40 rounded-full border-2 border-black/40 overflow-hidden mb-4">
              <div
                className={`h-full rounded-full transition-[width] duration-100 ${
                  timerPct > 50 ? 'bg-green-500' : timerPct > 25 ? 'bg-yellow-400' : 'bg-red-500'
                }`}
                style={{ width: `${timerPct}%` }}
              ></div>
            </div>
          )}

          {/* PAIRS BOARD */}
          {isPairs && (
            <div className="flex-1 flex flex-col justify-center">
              <PairsBoard
                pairs={pairsData}
                timerSec={config.pairs.timerSec}
                onFinish={handleBoardFinish}
              />
            </div>
          )}

          {/* QUESTION CARD (classic + balloon) */}
          {!isPairs && question && (
            <div
              key={qIndex}
              className={`anim-slide-in-q flex-1 bg-white rounded-3xl border-8 border-(--t-side-deep) shadow-2xl flex flex-col split:flex-row items-center justify-center gap-4 md:gap-6 split:gap-5 p-4 md:p-6 short:p-3 pb-16 short:pb-9 overflow-y-auto relative ${
                feedback && !feedback.correct ? 'anim-shake' : ''
              } ${feedback ? (feedback.correct ? 'outline outline-8 outline-green-400' : 'outline outline-8 outline-rose-400') : ''}`}
            >
              {/* ask on one side, answer on the other when the screen is short */}
              <div className="flex flex-col items-center justify-center gap-3 md:gap-5 split:flex-1 split:min-w-0 split:h-full">
                <div className={`${event.headerColor} px-6 py-1.5 rounded-full border-b-4 border-black/20 short:hidden`}>
                  <span className="text-white font-black tracking-wide drop-shadow-sm">
                    {isBalloon ? `${MODES.balloon.label} · ${event.title}` : event.title}
                  </span>
                </div>

                {question.prompt && (
                  <p className="text-2xl md:text-4xl short:text-xl font-black text-slate-800 text-center leading-snug" dir="rtl">
                    {question.prompt}
                  </p>
                )}

                <PromptDisplay display={question.display} onRepeat={repeatPrompt} />
              </div>

              <div className="w-full split:flex-1 split:min-w-0 flex items-center justify-center">
                <Widget
                  key={qIndex}
                  question={question}
                  disabled={phase !== 'ask'}
                  onAnswer={(ok, fxDelay = 0) => handleAnswer(ok, false, fxDelay)}
                />
              </div>

              {/* floating coin gain */}
              {feedback?.correct && !practice && (
                <div className="anim-float-up absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-1 text-yellow-500 font-black text-2xl pointer-events-none z-10" dir="ltr">
                  <Coins size={22} className="fill-yellow-200" /> +{feedback.gained}
                </div>
              )}

              {feedback && (
                <div
                  className={`absolute bottom-0 left-0 right-0 py-3 px-6 text-center font-black text-white text-xl md:text-2xl anim-pop ${
                    feedback.correct ? 'bg-green-500' : 'bg-rose-500'
                  }`}
                  dir="rtl"
                >
                  {feedback.correct ? (
                    <span className="flex items-center justify-center gap-2">
                      {feedback.cheer}
                      {!practice && (
                        <span className="flex items-center gap-1" dir="ltr">
                          <Coins size={20} className="fill-yellow-200 text-yellow-200" /> +{feedback.gained}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2 flex-wrap">
                      {feedback.timedOut ? 'נגמר הזמן! התשובה:' : 'לא נורא! התשובה:'}
                      <span className="text-3xl md:text-4xl leading-none" dir="auto">{question.answerText}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* RESULTS — treasure box finale */}
      {phase === 'results' && (
        <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden overflow-y-auto">
          {isWin && <Confetti colors={theme?.confetti} />}
          <div className="anim-zoom-in bg-white rounded-3xl border-8 border-(--t-side-deep) shadow-2xl w-full max-w-md overflow-hidden relative z-10 my-auto">
            <div className={`p-4 md:p-5 text-center border-b-8 border-black/10 ${resultUi.grad}`}>
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-wide drop-shadow-md flex items-center justify-center gap-3">
                {isWin ? (
                  <Trophy className="fill-yellow-200 text-yellow-400" size={34} />
                ) : isDraw ? (
                  <Star className="fill-yellow-200 text-yellow-300" size={34} />
                ) : (
                  <span className="text-3xl leading-none">💪</span>
                )}
                {resultUi.title}
              </h2>
            </div>

            <div className="p-5 md:p-6 flex flex-col items-center gap-4 bg-slate-50">
              <VaultReveal
                coins={unified.finalCoins}
                xp={unified.xpEarned}
                result={unified.resultLabel}
                practice={practice}
                onDone={() => setRevealDone(true)}
              />

              <div className={`flex flex-col items-center gap-3 w-full transition-opacity duration-500 ${revealDone ? 'opacity-100' : 'opacity-30'}`}>
                <p className="text-xl md:text-2xl font-black text-slate-700" dir="rtl">
                  {unified.correct} מתוך {unified.totalUnits} {isPairs ? 'זוגות' : 'נכונות'}!
                </p>

                {leveledUp && (
                  <div className="flex items-center gap-2 bg-orange-100 border-4 border-orange-300 px-5 py-2 rounded-2xl anim-pop">
                    <ChevronUp className="text-orange-500" size={26} strokeWidth={4} />
                    <span className="font-black text-orange-600 text-xl">עלית רמה! רמה {state.level}</span>
                  </div>
                )}

                {newTrophies.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 bg-yellow-100 border-4 border-yellow-400 px-5 py-2 rounded-2xl anim-pop">
                    <Trophy className="text-yellow-600 fill-yellow-300" size={24} />
                    <span className="font-black text-yellow-700">גביע חדש! {t.title}</span>
                  </div>
                ))}

                <div className="flex gap-3 w-full">
                  <div className="flex-1 bg-white border-4 border-slate-200 rounded-2xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-yellow-500 font-black text-2xl tabular-nums">
                      <Coins size={22} className="fill-yellow-200" /> {practice ? 0 : unified.finalCoins}
                    </div>
                    <span className="text-xs font-bold text-slate-400">מטבעות</span>
                  </div>
                  <div className="flex-1 bg-white border-4 border-slate-200 rounded-2xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-blue-500 font-black text-2xl tabular-nums">
                      <Sparkles size={22} /> {unified.xpEarned}
                    </div>
                    <span className="text-xs font-bold text-slate-400">XP</span>
                  </div>
                </div>

                {practice && (
                  <p className="text-sm font-bold text-blue-600" dir="rtl">משחק אימון — בלי מטבעות, רק XP</p>
                )}
                {isWin && !practice && (
                  <p className="text-sm font-bold text-green-600" dir="rtl">כולל בונוס ניצחון +{config.winBonusCoins}!</p>
                )}
              </div>

              <div className="flex gap-3 w-full mt-1">
                <button
                  onClick={onPlayAgain}
                  className="flex-1 bg-blue-500 hover:bg-blue-400 text-white text-xl font-black py-3 rounded-2xl border-b-8 border-blue-700 active:border-b-0 active:translate-y-2 transition-all"
                >
                  עוד פעם
                </button>
                <button
                  onClick={onExit}
                  className="flex-1 bg-green-500 hover:bg-green-400 text-white text-xl font-black py-3 rounded-2xl border-b-8 border-green-700 active:border-b-0 active:translate-y-2 transition-all"
                >
                  סיום
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const DEFAULT_CONFETTI = ['#facc15', '#f472b6', '#38bdf8', '#a78bfa', '#fb923c', '#ffffff']

function Confetti({ colors }) {
  const palette = colors?.length ? colors : DEFAULT_CONFETTI
  // positions are rolled once so re-renders don't reshuffle the falling pieces
  const [pieces] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 2.2 + Math.random() * 1.8,
      color: palette[i % palette.length],
      size: 8 + Math.random() * 8,
    })),
  )
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece absolute rounded-sm"
          style={{
            left: `${p.left}%`,
            top: 0,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        ></div>
      ))}
    </div>
  )
}
