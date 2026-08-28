import { useEffect, useRef, useState } from 'react'
import { sfx } from '../match/sounds.js'
import { useTheme } from '../context/ThemeContext.jsx'
import ArcadeShell from './ArcadeShell.jsx'

const ROUND_SEC = 60
const START_LIVES = 3
const BONUS = '✨' // rare sparkle, worth more than the theme's `good` item
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'

function drawEmoji(ctx, ch, x, y, size, rot = 0) {
  ctx.save()
  ctx.translate(x, y)
  if (rot) ctx.rotate(rot)
  ctx.font = `${size}px ${EMOJI_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(ch, 0, size * 0.06)
  ctx.restore()
}

/**
 * Catch — drag the basket, collect the theme's `good` emoji (+10) and sparkles
 * (+30), let the `bad` one fall past (touching it costs a heart). 60s round or
 * 3 hearts. Tuned Tuned gently for a first grader: slower fall, wider
 * basket, fewer hazards, slower ramp.
 */
export default function Catch({ highScore, onClose, onScore, onRestart }) {
  const { theme } = useTheme()
  const skin = theme.arcade.catch
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  // all game state lives in a ref — the RAF loop mutates it without re-renders
  const g = useRef(null)
  const [hud, setHud] = useState({ score: 0, lives: START_LIVES, time: ROUND_SEC })
  const [over, setOver] = useState(null) // { score, isRecord }
  const reportedRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    // theme colors for the basket (CSS vars are inherited from the app root)
    const css = getComputedStyle(canvas)
    const accent = css.getPropertyValue('--t-accent-deep').trim() || '#f472b6'
    const good = skin.good
    const bad = skin.bad

    const resize = () => {
      const r = wrap.getBoundingClientRect()
      canvas.width = r.width * dpr
      canvas.height = r.height * dpr
      canvas.style.width = `${r.width}px`
      canvas.style.height = `${r.height}px`
    }
    resize()
    window.addEventListener('resize', resize)

    g.current = {
      basketX: canvas.width / 2,
      items: [],
      score: 0,
      lives: START_LIVES,
      startTs: performance.now(),
      lastSpawn: 0,
      hitFlash: 0,
      catchFlash: 0,
      done: false,
    }

    const onPointer = (e) => {
      const r = canvas.getBoundingClientRect()
      g.current.basketX = (e.clientX - r.left) * dpr
    }
    canvas.addEventListener('pointerdown', onPointer)
    canvas.addEventListener('pointermove', onPointer)

    let raf
    const loop = (now) => {
      const s = g.current
      if (!s || s.done) return
      const W = canvas.width
      const H = canvas.height
      const elapsed = (now - s.startTs) / 1000
      const timeLeft = Math.max(0, ROUND_SEC - elapsed)
      const difficulty = 1 + elapsed / 35 // gentle speed + spawn ramp

      // spawn
      if (now - s.lastSpawn > 900 / difficulty) {
        s.lastSpawn = now
        const roll = Math.random()
        const kind = roll < 0.7 ? 'good' : roll < 0.8 ? 'bonus' : 'bad'
        s.items.push({
          kind,
          x: (0.08 + Math.random() * 0.84) * W,
          y: -24 * dpr,
          vy: (1.5 + Math.random() * 0.9) * difficulty * dpr,
          wob: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.02,
          rot: 0,
        })
      }

      const bw = 120 * dpr
      const bh = 40 * dpr
      const by = H - 72 * dpr
      const bx = Math.max(bw / 2, Math.min(W - bw / 2, s.basketX))

      // move + collide
      for (const it of s.items) {
        it.y += it.vy
        it.x += Math.sin(it.wob + it.y / (40 * dpr)) * 0.6 * dpr
        it.rot += it.spin
        const caught = it.y > by - 10 * dpr && it.y < by + bh && Math.abs(it.x - bx) < bw / 2 + 10 * dpr
        if (caught && !it.dead) {
          it.dead = true
          if (it.kind === 'good') { s.score += 10; s.catchFlash = now; sfx.coin() }
          else if (it.kind === 'bonus') { s.score += 30; s.catchFlash = now; sfx.ding() }
          else { s.lives -= 1; s.hitFlash = now; sfx.buzz() }
        }
      }
      s.items = s.items.filter((it) => !it.dead && it.y < H + 30 * dpr)

      /* ---- draw (backdrop gradient lives in the shell; canvas stays transparent) ---- */
      ctx.clearRect(0, 0, W, H)

      // soft white flash on a hazard touch — no red, nothing scary
      if (now - s.hitFlash < 180) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.fillRect(0, 0, W, H)
      }

      for (const it of s.items) {
        const ch = it.kind === 'good' ? good : it.kind === 'bonus' ? BONUS : bad
        drawEmoji(ctx, ch, it.x, it.y, 32 * dpr, it.rot)
      }

      // basket: white pastel bowl with a theme-colored rim and handle
      const glow = now - s.catchFlash < 160
      ctx.lineWidth = 4 * dpr
      ctx.strokeStyle = accent
      ctx.fillStyle = glow ? '#fff7fb' : 'rgba(255,255,255,0.92)'
      ctx.beginPath()
      ctx.arc(bx, by, bw * 0.34, Math.PI, 0) // handle
      ctx.stroke()
      ctx.beginPath()
      ctx.roundRect(bx - bw / 2, by, bw, bh, [8 * dpr, 8 * dpr, 18 * dpr, 18 * dpr])
      ctx.fill()
      ctx.stroke()
      ctx.globalAlpha = 0.45
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.roundRect(bx - bw / 2 + 8 * dpr, by + 8 * dpr, bw - 16 * dpr, 8 * dpr, 4 * dpr)
      ctx.fill()
      ctx.globalAlpha = 1

      // update HUD only when a visible value changes (avoids 60fps re-renders)
      const tl = Math.ceil(timeLeft)
      setHud((h) => (h.score === s.score && h.lives === s.lives && h.time === tl ? h : { score: s.score, lives: s.lives, time: tl }))

      if (timeLeft <= 0 || s.lives <= 0) {
        s.done = true
        const isRecord = s.score > highScore
        if (isRecord) sfx.fanfare()
        setOver({ score: s.score, isRecord })
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointerdown', onPointer)
      canvas.removeEventListener('pointermove', onPointer)
      if (g.current) g.current.done = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // report score once when the round ends
  useEffect(() => {
    if (!over || reportedRef.current) return
    reportedRef.current = true
    onScore(over.score)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over])

  return (
    <ArcadeShell title={skin.title} hud={hud} over={over} highScore={highScore} onClose={onClose} onRestart={onRestart} wrapRef={wrapRef}>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </ArcadeShell>
  )
}
