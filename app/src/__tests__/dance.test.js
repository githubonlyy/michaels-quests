import { describe, it, expect } from 'vitest'
import {
  MOVES,
  LANES,
  PERFECT_MS,
  GOOD_MS,
  SCORE,
  LEAD_IN_BEATS,
  APPROACH_BEATS,
  beatMs,
  buildChart,
  timeChart,
  judge,
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
} from '../world/dance/engine.js'
import {
  DANCE_SONGS,
  DANCE_SONG_IDS,
  getTrack,
  getBeatClock,
  playMusic,
  stopMusic,
  isMusicOn,
  setMusicOn,
} from '../match/music.js'

const HEBREW = /[֐-׿]/

// notes per beat inside [fromBeat, toBeat)
const density = (chart, fromBeat, toBeat) => chart.filter((n) => n.beat >= fromBeat && n.beat < toBeat).length / (toBeat - fromBeat)

describe('moves', () => {
  it('has four lanes, each with an emoji and a Hebrew word', () => {
    expect(MOVES).toHaveLength(4)
    expect(LANES).toBe(4)
    for (const m of MOVES) {
      expect(m.emoji).toBeTruthy()
      expect(m.name).toMatch(HEBREW)
      expect(m.id).toMatch(/^[a-z]+$/)
    }
    expect(new Set(MOVES.map((m) => m.id)).size).toBe(4)
  })
})

describe('buildChart', () => {
  it('never puts two notes on the same beat (no two lanes at once), sorted, lanes in range', () => {
    for (const song of DANCE_SONGS) {
      for (let seed = 1; seed <= 5; seed++) {
        const chart = buildChart({ beats: song.beats, seed })
        expect(chart.length).toBeGreaterThan(20)
        const beats = chart.map((n) => n.beat)
        expect(new Set(beats).size).toBe(beats.length)
        for (let i = 1; i < chart.length; i++) expect(chart[i].beat - chart[i - 1].beat).toBeGreaterThanOrEqual(1)
        for (const n of chart) {
          expect(n.lane).toBeGreaterThanOrEqual(0)
          expect(n.lane).toBeLessThan(LANES)
          expect(Number.isInteger(n.beat)).toBe(true)
        }
      }
    }
  })

  it('leaves a lead-in and the final beats empty', () => {
    const chart = buildChart({ beats: 128, seed: 7 })
    expect(chart[0].beat).toBe(LEAD_IN_BEATS)
    expect(chart[chart.length - 1].beat).toBeLessThanOrEqual(126)
  })

  it('density ramps from about one note every two beats to about one per beat', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const beats = 128
      const chart = buildChart({ beats, seed })
      const span = beats - LEAD_IN_BEATS
      const q = Math.floor(span / 4)
      const first = density(chart, LEAD_IN_BEATS, LEAD_IN_BEATS + q)
      const last = density(chart, beats - 2 - q, beats - 2)
      expect(first, `seed ${seed} first quarter`).toBeGreaterThanOrEqual(0.45)
      expect(first, `seed ${seed} first quarter`).toBeLessThanOrEqual(0.7)
      expect(last, `seed ${seed} last quarter`).toBeGreaterThanOrEqual(0.8)
      expect(last).toBeGreaterThan(first)
    }
  })

  it('is deterministic per seed and varies across seeds', () => {
    const a = buildChart({ beats: 120, seed: 42 })
    const b = buildChart({ beats: 120, seed: 42 })
    const c = buildChart({ beats: 120, seed: 43 })
    expect(a).toEqual(b)
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c))
  })

  it('timeChart converts beats to ms at the song bpm', () => {
    const timed = timeChart(buildChart({ beats: 64, seed: 1 }), 120)
    for (const n of timed) {
      expect(n.timeMs).toBeCloseTo(n.beat * 500, 6)
      expect(n.result).toBeNull()
    }
  })
})

describe('judge windows', () => {
  it('perfect within ±180ms, good within ±350ms, otherwise nothing', () => {
    expect(PERFECT_MS).toBe(180)
    expect(GOOD_MS).toBe(350)
    expect(judge(0)).toBe('perfect')
    expect(judge(180)).toBe('perfect')
    expect(judge(-180)).toBe('perfect')
    expect(judge(181)).toBe('good')
    expect(judge(-300)).toBe('good')
    expect(judge(350)).toBe('good')
    expect(judge(351)).toBeNull()
    expect(judge(-1000)).toBeNull()
  })

  it('judgeTap picks the closest unjudged note in that lane only', () => {
    const notes = [
      { timeMs: 1000, lane: 0, result: null },
      { timeMs: 1000, lane: 1, result: null },
      { timeMs: 1500, lane: 0, result: null },
    ]
    expect(judgeTap(notes, 0, 1100)).toEqual({ index: 0, judgement: 'perfect', offsetMs: 100 })
    expect(judgeTap(notes, 0, 1300)).toEqual({ index: 2, judgement: 'good', offsetMs: -200 })
    expect(judgeTap(notes, 2, 1000)).toBeNull() // no note in that lane
    expect(judgeTap(notes, 0, 3000)).toBeNull() // nothing nearby — ignored, not punished
    notes[0].result = 'perfect'
    expect(judgeTap(notes, 0, 1100)).toBeNull() // already hit
    expect(judgeTap(notes, 1, 1100).index).toBe(1)
  })

  it('sweepMisses returns only unjudged notes whose window has closed', () => {
    const notes = [
      { timeMs: 1000, lane: 0, result: 'good' },
      { timeMs: 1200, lane: 1, result: null },
      { timeMs: 2000, lane: 2, result: null },
    ]
    expect(sweepMisses(notes, 1500)).toEqual([])
    expect(sweepMisses(notes, 1200 + GOOD_MS + 1)).toEqual([1])
    expect(sweepMisses(notes, 5000)).toEqual([1, 2])
  })
})

describe('scoring', () => {
  it('scores 100 perfect / 60 good / 0 miss', () => {
    expect(SCORE).toEqual({ perfect: 100, good: 60, miss: 0 })
    expect(scoreFor('perfect')).toBe(100)
    expect(scoreFor('good')).toBe(60)
    expect(scoreFor('miss')).toBe(0)
    expect(scoreFor(null)).toBe(0)
  })

  it('summarize counts results and totals the score', () => {
    const notes = [{ result: 'perfect' }, { result: 'perfect' }, { result: 'good' }, { result: 'miss' }, { result: null }]
    expect(summarize(notes)).toEqual({ perfect: 2, good: 1, miss: 2, total: 5, hits: 3, score: 260, pct: 0.6 })
  })

  it('stars: 3 from 85%, 2 from 55%, never fewer than 1', () => {
    expect(stars(17, 20)).toBe(3)
    expect(stars(20, 20)).toBe(3)
    expect(stars(16, 20)).toBe(2)
    expect(stars(11, 20)).toBe(2)
    expect(stars(10, 20)).toBe(1)
    expect(stars(0, 20)).toBe(1)
    expect(stars(0, 0)).toBe(1)
  })

  it('cheers in Hebrew at combo 5 / 10 / 20 only', () => {
    expect(comboCheer(4)).toBeNull()
    expect(comboCheer(5)).toMatch(HEBREW)
    expect(comboCheer(10)).toMatch(HEBREW)
    expect(comboCheer(20)).toBe('מלך הריקוד!')
    expect(comboCheer(21)).toBeNull()
  })

  it('result line is Hebrew and mentions a new record', () => {
    for (const s of [1, 2, 3]) expect(resultLine(s)).toMatch(HEBREW)
    expect(resultLine(3, true)).toMatch(/^שיא חדש!/)
    expect(resultLine(3, false)).not.toMatch(/שיא/)
  })
})

describe('geometry & timing helpers', () => {
  it('songEndMs is never before the last beat or the last note window', () => {
    const bpm = 120
    const notes = timeChart(buildChart({ beats: 128, seed: 3 }), bpm)
    const end = songEndMs(notes, bpm, 128)
    expect(end).toBeGreaterThanOrEqual(128 * beatMs(bpm))
    expect(end).toBeGreaterThanOrEqual(notes[notes.length - 1].timeMs + GOOD_MS + 1200)
  })

  it('noteY sits at the target on the beat and at spawn one approach earlier', () => {
    const approach = APPROACH_BEATS * beatMs(120)
    expect(noteY(4000, 4000, approach, -72, 500)).toBe(500)
    expect(noteY(4000, 4000 - approach, approach, -72, 500)).toBe(-72)
    expect(noteY(4000, 4000 - approach / 2, approach, -72, 500)).toBe(214)
    expect(noteY(4000, 4200, approach, -72, 500)).toBeGreaterThan(500) // past the target
  })

  it('laneAt maps the tap offset from the start edge to a clamped lane', () => {
    expect(laneAt(0, 400)).toBe(0)
    expect(laneAt(99, 400)).toBe(0)
    expect(laneAt(100, 400)).toBe(1)
    expect(laneAt(399, 400)).toBe(3)
    expect(laneAt(450, 400)).toBe(3)
    expect(laneAt(-5, 400)).toBe(0)
    expect(laneAt(10, 0)).toBe(0)
  })
})

describe('music.js dance tracks', () => {
  it('keeps the original API', () => {
    for (const fn of [playMusic, stopMusic, isMusicOn, setMusicOn, getBeatClock, getTrack]) expect(typeof fn).toBe('function')
    expect(getBeatClock()).toBeNull() // nothing playing (no WebAudio in node)
    for (const id of ['lobby', 'match']) {
      const t = getTrack(id)
      expect(t.melody).toHaveLength(32)
      expect(t.bass).toHaveLength(32)
      expect(t.bpm).toBeGreaterThan(0)
    }
    expect(getTrack('nope')).toBeNull()
  })

  it('has at least two dance songs, 110–130 bpm, about a minute long, Hebrew names', () => {
    expect(DANCE_SONGS.length).toBeGreaterThanOrEqual(2)
    expect(DANCE_SONGS.map((s) => s.id)).toEqual(DANCE_SONG_IDS)
    for (const s of DANCE_SONGS) {
      expect(s.bpm, s.id).toBeGreaterThanOrEqual(110)
      expect(s.bpm, s.id).toBeLessThanOrEqual(130)
      const seconds = (s.beats * 60) / s.bpm
      expect(seconds, `${s.id} length`).toBeGreaterThanOrEqual(55)
      expect(seconds, `${s.id} length`).toBeLessThanOrEqual(80)
      expect(s.name, s.id).toMatch(HEBREW)
      expect(s.emoji, s.id).toBeTruthy()
    }
  })

  it('every section of every dance song is 32 sixteenth-steps of sane midi / drum values', () => {
    for (const id of DANCE_SONG_IDS) {
      const t = getTrack(id)
      expect(t, id).toBeTruthy()
      expect(t.sections.length, id).toBeGreaterThanOrEqual(2)
      for (const part of t.sections) {
        for (const key of ['melody', 'bass', 'drums']) expect(part[key], `${id}.${key}`).toHaveLength(32)
        for (const m of [...part.melody, ...part.bass]) expect(m === 0 || (m >= 36 && m <= 96), `${id} midi ${m}`).toBe(true)
        for (const d of part.drums) expect([0, 1, 2, 3]).toContain(d)
        expect(part.melody.some((m) => m > 0), `${id} melody has notes`).toBe(true)
        expect(part.drums.some((d) => d === 1), `${id} has a kick`).toBe(true)
      }
    }
  })
})
