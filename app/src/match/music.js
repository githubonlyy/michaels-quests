// Chiptune background music — synthesized with WebAudio, no audio files.
// Looping tracks: 'lobby' (bouncy major), 'match' (driving minor) and the
// 'dance1..3' songs the rhythm game dances to (with drums and A/B sections).
// Separate toggle from sfx; starts only after a user gesture (autoplay policy).

const MUSIC_KEY = 'michaels-quests-music'
let ctx = null
let master = null
let noiseBuf = null // shared white-noise buffer for drum hits
let current = null // { name, bpm, timer, step, part, nextTime, startTime }
let enabled = (() => {
  try { return localStorage.getItem(MUSIC_KEY) !== '0' } catch { return true }
})()

const midi2freq = (m) => 440 * Math.pow(2, (m - 69) / 12)

// 32 sixteenth-steps (2 bars); 0 = rest
const TRACKS = {
  lobby: {
    bpm: 112,
    melody: [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 81, 0, 79, 0, 76, 0,
             72, 0, 76, 0, 79, 0, 83, 0, 84, 0, 79, 0, 76, 0, 74, 0],
    bass: [48, 0, 0, 0, 43, 0, 0, 0, 45, 0, 0, 0, 41, 0, 0, 0,
           48, 0, 0, 0, 43, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0],
  },
  match: {
    bpm: 140,
    melody: [69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 72, 0, 77, 0, 76, 0,
             67, 0, 71, 0, 74, 0, 71, 0, 69, 0, 72, 0, 76, 0, 79, 0],
    bass: [45, 0, 0, 0, 45, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0,
           45, 0, 0, 0, 45, 0, 0, 0, 40, 0, 0, 0, 43, 0, 0, 0],
  },

  // Dance songs. Same 32-step format per section, plus `drums` (1 kick,
  // 2 hi-hat, 3 snare). `sections` cycle A A B A so a minute-long song is not
  // one loop; `beats` is how many quarter notes the rhythm game plays.
  dance1: {
    name: 'ריקוד הכוכבים',
    emoji: '⭐',
    bpm: 120,
    beats: 128, // 64 s
    sections: (() => {
      const drums = [1, 0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 0, 3, 0, 2, 0,
                     1, 0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 0, 3, 0, 2, 2]
      const A = {
        melody: [72, 0, 72, 0, 76, 0, 79, 0, 79, 0, 76, 0, 72, 0, 74, 0,
                 76, 0, 74, 0, 72, 0, 69, 0, 71, 0, 74, 0, 72, 0, 0, 0],
        bass: [48, 0, 0, 0, 55, 0, 0, 0, 45, 0, 0, 0, 52, 0, 0, 0,
               41, 0, 0, 0, 48, 0, 0, 0, 43, 0, 0, 0, 50, 0, 0, 0],
        drums,
      }
      const B = {
        melody: [79, 0, 81, 0, 79, 0, 76, 0, 77, 0, 76, 0, 74, 0, 72, 0,
                 74, 0, 76, 0, 77, 0, 79, 0, 81, 0, 79, 0, 76, 0, 0, 0],
        bass: [45, 0, 0, 0, 52, 0, 0, 0, 41, 0, 0, 0, 48, 0, 0, 0,
               48, 0, 0, 0, 55, 0, 0, 0, 43, 0, 0, 0, 50, 0, 0, 0],
        drums,
      }
      return [A, A, B, A]
    })(),
  },
  dance2: {
    name: 'מסיבת בועות',
    emoji: '🫧',
    bpm: 112,
    beats: 120, // 64 s
    sections: (() => {
      const drums = [1, 0, 2, 2, 3, 0, 2, 0, 1, 0, 2, 2, 3, 0, 2, 0,
                     1, 0, 2, 2, 3, 0, 2, 0, 1, 0, 2, 2, 3, 2, 2, 2]
      const A = {
        melody: [76, 0, 0, 76, 0, 79, 0, 0, 81, 0, 79, 0, 76, 0, 74, 0,
                 72, 0, 0, 72, 0, 74, 0, 0, 76, 0, 74, 0, 72, 0, 0, 0],
        bass: [48, 0, 0, 0, 48, 0, 55, 0, 45, 0, 0, 0, 45, 0, 52, 0,
               41, 0, 0, 0, 41, 0, 48, 0, 43, 0, 0, 0, 43, 0, 50, 0],
        drums,
      }
      const B = {
        melody: [84, 0, 0, 83, 0, 81, 0, 0, 79, 0, 81, 0, 79, 0, 76, 0,
                 77, 0, 0, 77, 0, 76, 0, 0, 74, 0, 72, 0, 74, 0, 0, 0],
        bass: [41, 0, 0, 0, 41, 0, 48, 0, 43, 0, 0, 0, 43, 0, 50, 0,
               45, 0, 0, 0, 45, 0, 52, 0, 43, 0, 0, 0, 43, 0, 50, 0],
        drums,
      }
      return [A, A, B, A]
    })(),
  },
  dance3: {
    name: 'קפיצת הקשת',
    emoji: '🌈',
    bpm: 128,
    beats: 144, // 67 s
    sections: (() => {
      const drums = [1, 0, 2, 0, 3, 2, 2, 0, 1, 0, 2, 0, 3, 2, 2, 2,
                     1, 0, 2, 0, 3, 2, 2, 0, 1, 0, 2, 0, 3, 2, 3, 2]
      const A = {
        melody: [79, 0, 79, 0, 83, 0, 86, 0, 83, 0, 79, 0, 81, 0, 79, 0,
                 78, 0, 79, 0, 81, 0, 83, 0, 81, 0, 78, 0, 74, 0, 0, 0],
        bass: [43, 0, 0, 0, 50, 0, 0, 0, 40, 0, 0, 0, 47, 0, 0, 0,
               48, 0, 0, 0, 55, 0, 0, 0, 50, 0, 0, 0, 57, 0, 0, 0],
        drums,
      }
      const B = {
        melody: [86, 0, 88, 0, 86, 0, 83, 0, 84, 0, 83, 0, 81, 0, 79, 0,
                 81, 0, 83, 0, 84, 0, 86, 0, 88, 0, 86, 0, 83, 0, 0, 0],
        bass: [48, 0, 0, 0, 55, 0, 0, 0, 50, 0, 0, 0, 57, 0, 0, 0,
               40, 0, 0, 0, 47, 0, 0, 0, 50, 0, 0, 0, 57, 0, 0, 0],
        drums,
      }
      return [A, A, B, A]
    })(),
  },
}

// Song list for the dance picker (order = display order)
export const DANCE_SONG_IDS = ['dance1', 'dance2', 'dance3']
export const DANCE_SONGS = DANCE_SONG_IDS.map((id) => {
  const t = TRACKS[id]
  return { id, name: t.name, emoji: t.emoji, bpm: t.bpm, beats: t.beats }
})
export const getTrack = (name) => TRACKS[name] ?? null

const isHidden = () => typeof document !== 'undefined' && document.hidden

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  // never wake the audio device while the app is in the background
  if (ctx.state === 'suspended' && !isHidden()) ctx.resume()
  return ctx
}

// Background rule: a hidden tab (tablet locked, app switched, browser minimized)
// must go silent. The scheduler stops queueing notes and the AudioContext is
// suspended — its clock freezes, so the track picks up where it left off.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (current) {
        clearInterval(current.timer)
        current.timer = null
      }
      ctx?.suspend?.()
    } else if (current) {
      ctx?.resume?.()
      if (!current.timer) current.timer = setInterval(current.tick, 120)
    }
  })
}

function note(freq, t, dur, type, vol) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain).connect(master)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noiseBuffer() {
  if (!noiseBuf) {
    const len = Math.floor(ctx.sampleRate * 0.2)
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

// 1 kick (pitched sine drop), 2 hi-hat (short bright noise), 3 snare (noise + body)
function drum(kind, t) {
  if (kind === 1) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12)
    gain.gain.setValueAtTime(0.32, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    osc.connect(gain).connect(master)
    osc.start(t)
    osc.stop(t + 0.2)
    return
  }
  const hat = kind === 2
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer()
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = hat ? 6000 : 1400
  const gain = ctx.createGain()
  const dur = hat ? 0.04 : 0.11
  gain.gain.setValueAtTime(hat ? 0.07 : 0.14, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter).connect(gain).connect(master)
  src.start(t)
  src.stop(t + dur + 0.02)
  if (!hat) note(180, t, 0.08, 'triangle', 0.1)
}

// `part` is a { melody, bass, drums? } section
function scheduleStep(part, step, t, stepDur) {
  const m = part.melody[step]
  const b = part.bass[step]
  const d = part.drums?.[step]
  if (m) note(midi2freq(m), t, stepDur * 1.8, 'square', 0.045)
  if (b) note(midi2freq(b), t, stepDur * 3.5, 'triangle', 0.09)
  if (d) drum(d, t)
}

export const isMusicOn = () => enabled

export function setMusicOn(v) {
  enabled = v
  try { localStorage.setItem(MUSIC_KEY, v ? '1' : '0') } catch { /* ignore */ }
  if (!v) stopMusic()
}

export function stopMusic() {
  if (!current) return
  if (current.timer) clearInterval(current.timer)
  current = null
}

/**
 * Start a looping track. Already-playing tracks are left alone unless
 * `restart` is set (the rhythm game wants beat 0 to line up with a fresh start).
 */
export function playMusic(name, { restart = false } = {}) {
  if (!enabled) return
  if (current?.name === name && !restart) return
  const c = ac()
  if (!c) return
  stopMusic()

  const track = TRACKS[name]
  if (!track) return
  const parts = track.sections ?? [track]
  const stepDur = 60 / track.bpm / 4 // sixteenth note
  const startTime = c.currentTime + 0.05
  const state = { name, bpm: track.bpm, step: 0, part: 0, nextTime: startTime, startTime, timer: null, tick: null }

  // lookahead scheduler: keep ~0.35s of audio queued. Named so the
  // visibilitychange handler above can stop and restart it.
  state.tick = () => {
    if (!ctx || document.hidden) return
    while (state.nextTime < ctx.currentTime + 0.35) {
      const part = parts[state.part]
      scheduleStep(part, state.step, state.nextTime, stepDur)
      state.nextTime += stepDur
      state.step += 1
      if (state.step >= part.melody.length) {
        state.step = 0
        state.part = (state.part + 1) % parts.length
      }
    }
  }
  state.timer = setInterval(state.tick, 120)
  current = state
}

/**
 * Timing anchor of the playing track for games that sync to the beat:
 * `startTime` is beat 0 on the AudioContext clock, `now()` reads that clock.
 * Returns null when nothing is playing (music muted / no WebAudio) — callers
 * fall back to performance.now() at the same bpm.
 */
export function getBeatClock() {
  if (!current || !ctx) return null
  const { name, startTime, bpm } = current
  return { name, startTime, bpm, now: () => ctx.currentTime }
}
