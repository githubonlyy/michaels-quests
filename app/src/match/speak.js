// Hebrew text-to-speech via the browser's SpeechSynthesis. A pre-reader plays
// the whole app by ear, so every prompt goes through here. No-ops silently when
// the device has no speech engine or no Hebrew voice.

const SPEAK_KEY = 'michaels-quests-speech'
let enabled = (() => {
  try { return localStorage.getItem(SPEAK_KEY) !== '0' } catch { return true }
})()
let heVoice = null
let voicesLoaded = false

function synth() {
  return typeof window !== 'undefined' ? window.speechSynthesis : null
}

function pickVoice() {
  const s = synth()
  if (!s) return
  const voices = s.getVoices()
  if (!voices.length) return
  voicesLoaded = true
  // prefer a natural/online Hebrew voice, else any he-*
  heVoice =
    voices.find((v) => /^he/i.test(v.lang) && /natural|online|google/i.test(v.name)) ||
    voices.find((v) => /^he/i.test(v.lang)) ||
    null
}

if (synth()) {
  pickVoice()
  synth().addEventListener?.('voiceschanged', pickVoice)
  // nothing should keep talking once the tablet is locked or the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) synth().cancel()
  })
}

export const isSpeechOn = () => enabled
export function setSpeechOn(v) {
  enabled = v
  try { localStorage.setItem(SPEAK_KEY, v ? '1' : '0') } catch { /* ignore */ }
  if (!v) stopSpeaking()
}

export const canSpeak = () => !!synth()

export function stopSpeaking() {
  synth()?.cancel()
}

/**
 * Speak `text` in Hebrew. Cancels anything still playing so rapid taps don't
 * queue up. `delay` (ms) lets a widget animation finish first.
 */
export function speak(text, { delay = 0, rate = 0.9 } = {}) {
  const s = synth()
  if (!s || !enabled || !text) return
  if (!voicesLoaded) pickVoice()
  const go = () => {
    s.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'he-IL'
    if (heVoice) u.voice = heVoice
    u.rate = rate
    u.pitch = 1.1
    s.speak(u)
  }
  if (delay > 0) setTimeout(go, delay)
  else go()
}
