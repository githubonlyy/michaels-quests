// Pure rhythm-game logic for the Dance activity: chart generation, hit
// judgment, scoring and stars. No DOM, no audio, no React — everything here is
// unit-tested in src/__tests__/dance.test.js. Times are ms from song start
// (beat 0 = the first step the music scheduler plays).

export const MOVES = [
  { id: 'clap', emoji: '👏', name: 'מחיאה' },
  { id: 'hands', emoji: '🙌', name: 'ידיים למעלה' },
  { id: 'spin', emoji: '💃', name: 'סיבוב' },
  { id: 'jump', emoji: '🦘', name: 'קפיצה' },
]
export const LANES = MOVES.length

// Generous windows for a 7-year-old: ms either side of the note's beat.
export const PERFECT_MS = 180
export const GOOD_MS = 350
export const SCORE = { perfect: 100, good: 60, miss: 0 }

export const LEAD_IN_BEATS = 8 // no notes while she settles in
export const APPROACH_BEATS = 4 // a note is on screen this many beats before its hit
export const COMBO_CHEERS = { 5: 'יופי!', 10: 'מדהים!', 20: 'מלך הריקוד!' }

export const beatMs = (bpm) => 60000 / bpm

// mulberry32 — tiny seeded PRNG so charts are reproducible in tests
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Note chart for a song of `beats` quarter notes. Even beats (relative to the
 * lead-in) always carry a note; odd beats fill in with probability equal to
 * song progress, so density ramps from one note every two beats to roughly
 * one per beat by the end. One note per beat at most, so two lanes never
 * light up together. Returns [{ beat, lane }] sorted by beat.
 */
export function buildChart({ beats, seed = 1, leadIn = LEAD_IN_BEATS, lanes = LANES }) {
  const rand = rng(seed)
  const notes = []
  const last = beats - 2 // leave the final beats for the finale
  const span = Math.max(1, last - leadIn)
  let prevLane = -1
  for (let b = leadIn; b <= last; b++) {
    const rel = b - leadIn
    const progress = rel / span
    if (rel % 2 === 1 && rand() > progress) continue
    // avoid repeating the lane so the moves feel like choreography
    let lane = Math.floor(rand() * lanes)
    if (lane === prevLane) lane = (lane + 1 + Math.floor(rand() * (lanes - 1))) % lanes
    notes.push({ beat: b, lane })
    prevLane = lane
  }
  return notes
}

// Attach absolute times (ms) and an empty result slot to chart notes.
export function timeChart(chart, bpm) {
  const bm = beatMs(bpm)
  return chart.map((n) => ({ ...n, timeMs: n.beat * bm, result: null }))
}

// 'perfect' | 'good' | null (outside the window)
export function judge(offsetMs) {
  const d = Math.abs(offsetMs)
  if (d <= PERFECT_MS) return 'perfect'
  if (d <= GOOD_MS) return 'good'
  return null
}

/**
 * A tap on `lane` at `nowMs`: the closest unjudged note of that lane inside
 * the GOOD window, or null. Taps with nothing nearby are simply ignored —
 * the doll still dances, nothing is punished.
 */
export function judgeTap(notes, lane, nowMs) {
  let best = null
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]
    if (n.timeMs > nowMs + GOOD_MS) break // sorted by time; nothing later can match
    if (n.lane !== lane || n.result) continue
    const offsetMs = nowMs - n.timeMs
    const judgement = judge(offsetMs)
    if (!judgement) continue
    if (!best || Math.abs(offsetMs) < Math.abs(best.offsetMs)) best = { index: i, judgement, offsetMs }
  }
  return best
}

// Indices of unjudged notes whose window has closed without a tap.
export function sweepMisses(notes, nowMs) {
  const out = []
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]
    if (n.timeMs + GOOD_MS >= nowMs) break
    if (!n.result) out.push(i)
  }
  return out
}

export const scoreFor = (judgement) => SCORE[judgement] ?? 0

export function summarize(notes) {
  let perfect = 0
  let good = 0
  let miss = 0
  for (const n of notes) {
    if (n.result === 'perfect') perfect++
    else if (n.result === 'good') good++
    else miss++
  }
  const total = notes.length
  const hits = perfect + good
  return {
    perfect,
    good,
    miss,
    total,
    hits,
    score: perfect * SCORE.perfect + good * SCORE.good,
    pct: total ? hits / total : 0,
  }
}

// 1–3 stars by hit ratio. Never zero: she always gets something for dancing.
export function stars(hits, total) {
  if (!total) return 1
  const pct = hits / total
  if (pct >= 0.85) return 3
  if (pct >= 0.55) return 2
  return 1
}

export const comboCheer = (combo) => COMBO_CHEERS[combo] ?? null

// When the round ends: the song's last beat, or the last note's window plus
// a breath — whichever is later.
export function songEndMs(notes, bpm, beats) {
  const lastNote = notes.length ? notes[notes.length - 1].timeMs : 0
  return Math.max(beats * beatMs(bpm), lastNote + GOOD_MS + 1200)
}

// Vertical position (px) of a note that hits at `timeMs`: spawnY when it is
// `approachMs` away, hitY exactly on its beat, past hitY afterwards.
export function noteY(timeMs, nowMs, approachMs, spawnY, hitY) {
  return hitY - ((timeMs - nowMs) / approachMs) * (hitY - spawnY)
}

// Lane under a tap, measured from the lanes' start edge (right edge in RTL).
export function laneAt(offsetFromStart, width, lanes = LANES) {
  if (width <= 0) return 0
  const lane = Math.floor((offsetFromStart / width) * lanes)
  return Math.min(lanes - 1, Math.max(0, lane))
}

// Spoken Hebrew result line
export function resultLine(starCount, isRecord = false) {
  const line =
    starCount >= 3 ? 'שלושה כוכבים! מלך הריקוד!' : starCount === 2 ? 'שני כוכבים! מעולה!' : 'כוכב אחד! כל הכבוד, ממשיכים לרקוד!'
  return isRecord ? `שיא חדש! ${line}` : line
}
