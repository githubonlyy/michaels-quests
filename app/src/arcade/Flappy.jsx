import { useEffect, useRef, useState } from 'react'
import { sfx } from '../match/sounds.js'
import { useTheme } from '../context/ThemeContext.jsx'
import ArcadeShell from './ArcadeShell.jsx'

const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'

/**
 * Flappy — tap to fly the theme's `hero` emoji between soft rounded pillars
 * colored with the theme's `wall`. Tuned gently for a first grader:
 * lower gravity, slower scroll, wider gaps, more time between pillars.
 */
export default function Flappy({ highScore, onClose, onScore, onRestart }) {
  const { theme } = useTheme()
  const skin = theme.arcade.flappy
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const g = useRef(null)
  const [hud, setHud] = useState({ score: 0 })
  const [started, setStarted] = useState(false)
  const [over, setOver] = useState(null)
  const reportedRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const wall = skin.wall
    const hero = skin.hero

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
      y: canvas.height / 2,
      vy: 0,
      pipes: [],
      score: 0,
      started: false,
      lastSpawn: 0,
      done: false,
    }

    const flap = () => {
      const s = g.current
      if (!s || s.done) return
      if (!s.started) { s.started = true; setStarted(true) }
      s.vy = -6.8 * dpr
      sfx.flip()
    }
    canvas.addEventListener('pointerdown', flap)

    // pillar with a rounded, slightly bulbous end facing the gap (cloud / bud look)
    const drawPillar = (x, y, w, h, roundBottom) => {
      const r = w / 2
      ctx.fillStyle = wall
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, roundBottom ? [0, 0, r, r] : [r, r, 0, 0])
      ctx.fill()
      const capY = roundBottom ? y + h - r * 0.9 : y + r * 0.9
      ctx.beginPath()
      ctx.arc(x + w / 2, capY, r * 1.15, 0, Math.PI * 2)
      ctx.fill()
      // soft highlight stripe
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.beginPath()
      ctx.roundRect(x + w * 0.2, y + (roundBottom ? 0 : r), w * 0.16, Math.max(0, h - r), w * 0.08)
      ctx.fill()
    }

    let raf
    const loop = (now) => {
      const s = g.current
      if (!s || s.done) return
      const W = canvas.width
      const H = canvas.height
      const heroX = W * 0.28
      const R = 16 * dpr
      const speed = (1.9 + s.score * 0.03) * dpr
      const gap = Math.max(185 * dpr, (250 - s.score * 1.5) * dpr)
      const pipeW = 54 * dpr

      if (s.started) {
        s.vy += 0.3 * dpr
        s.y += s.vy

        if (now - s.lastSpawn > 1900) {
          s.lastSpawn = now
          const gapY = (0.25 + Math.random() * 0.45) * H
          s.pipes.push({ x: W + pipeW, gapY, passed: false })
        }
        for (const p of s.pipes) {
          p.x -= speed
          if (!p.passed && p.x + pipeW < heroX - R) {
            p.passed = true
            s.score += 1
            sfx.coin()
          }
        }
        s.pipes = s.pipes.filter((p) => p.x > -pipeW * 2)

        // collisions: floor/ceiling + pillars
        const hitPipe = s.pipes.some(
          (p) =>
            heroX + R > p.x && heroX - R < p.x + pipeW &&
            (s.y - R < p.gapY - gap / 2 || s.y + R > p.gapY + gap / 2),
        )
        if (s.y + R > H || s.y - R < 0 || hitPipe) {
          s.done = true
          sfx.buzz()
          const isRecord = s.score > highScore
          if (isRecord) sfx.fanfare()
          setOver({ score: s.score, isRecord })
          return
        }
      } else {
        s.y = H / 2 + Math.sin(now / 300) * 10 * dpr // idle hover
      }

      /* draw (backdrop gradient lives in the shell; canvas stays transparent) */
      ctx.clearRect(0, 0, W, H)

      for (const p of s.pipes) {
        const topH = p.gapY - gap / 2
        const botY = p.gapY + gap / 2
        drawPillar(p.x, -4 * dpr, pipeW, topH + 4 * dpr, true)
        drawPillar(p.x, botY, pipeW, H - botY + 4 * dpr, false)
      }

      // hero: mirrored so left-facing emoji fly toward the pillars, tilted by velocity
      const tilt = Math.max(-0.5, Math.min(0.6, s.vy / (10 * dpr)))
      ctx.save()
      ctx.translate(heroX, s.y)
      ctx.scale(-1, 1)
      ctx.rotate(-tilt)
      ctx.font = `${R * 2.4}px ${EMOJI_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(hero, 0, R * 0.15)
      ctx.restore()

      setHud((h) => (h.score === s.score ? h : { score: s.score }))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointerdown', flap)
      if (g.current) g.current.done = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!over || reportedRef.current) return
    reportedRef.current = true
    onScore(over.score)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over])

  return (
    <ArcadeShell title={skin.title} hud={hud} over={over} highScore={highScore} onClose={onClose} onRestart={onRestart} wrapRef={wrapRef}>
      <canvas ref={canvasRef} className="absolute inset-0" />
      {!started && !over && (
        <div className="absolute inset-x-0 top-1/4 flex justify-center pointer-events-none">
          <span className="anim-float-bob inline-block bg-white/90 text-(--t-side) font-black text-2xl px-6 py-3 rounded-2xl shadow-lg">
            הקישו כדי לעוף! {skin.hero}
          </span>
        </div>
      )}
    </ArcadeShell>
  )
}
