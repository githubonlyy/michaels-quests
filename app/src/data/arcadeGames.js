import Catch from '../arcade/Catch.jsx'
import Flappy from '../arcade/Flappy.jsx'
import Breaker from '../arcade/Breaker.jsx'
import Whack from '../arcade/Whack.jsx'

// Arcade catalog. price 0 = free starter game. Daily study-goal gate applies to all.
// Titles, descriptions and sprites are NOT here — they come from the active
// theme (`theme.arcade[key]`), resolved at render time via gameMeta().
export const ARCADE_GAMES = [
  {
    id: 'catch',
    key: 'catch',
    price: 0,
    icon: '🧺',
    color: 'bg-pink-400',
    borderColor: 'border-pink-600',
    textColor: 'text-pink-500',
    lightBg: 'bg-pink-100',
    Component: Catch,
  },
  {
    id: 'flappy',
    key: 'flappy',
    price: 1500,
    icon: '☁️',
    color: 'bg-violet-400',
    borderColor: 'border-violet-600',
    textColor: 'text-violet-500',
    lightBg: 'bg-violet-100',
    Component: Flappy,
  },
  {
    id: 'breaker',
    key: 'breaker',
    price: 2000,
    icon: '🫧',
    color: 'bg-sky-400',
    borderColor: 'border-sky-600',
    textColor: 'text-sky-500',
    lightBg: 'bg-sky-100',
    Component: Breaker,
  },
  {
    id: 'whack',
    key: 'whack',
    price: 2500,
    icon: '🎯',
    color: 'bg-emerald-400',
    borderColor: 'border-emerald-600',
    textColor: 'text-emerald-500',
    lightBg: 'bg-emerald-100',
    Component: Whack,
  },
]

/**
 * Resolve the theme-specific presentation of a game: Hebrew title, one-line
 * description, and a big emoji for the card (the collectible / hero sprite,
 * falling back to the game's neutral icon for skins without one).
 */
export function gameMeta(game, theme) {
  const skin = theme?.arcade?.[game.key] ?? {}
  return {
    title: skin.title ?? game.id,
    he: skin.he ?? '',
    emoji: skin.emoji ?? skin.good ?? skin.hero ?? game.icon,
    skin,
  }
}
