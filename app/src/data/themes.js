// The three worlds Michael picks from on every launch. Everything visual that
// is not subject-specific reads from here: shell colors (as CSS vars), confetti,
// floating particles, and the arcade sprite skins.
//
// CSS vars are applied inline on the app root by ThemeContext and consumed with
// Tailwind v4 arbitrary-var classes, e.g. `bg-(--t-side)`.

export const THEME_VAR_KEYS = [
  '--t-bg-from', // main area gradient start
  '--t-bg-to', // main area gradient end
  '--t-side', // sidebar / bottom-nav background
  '--t-side-deep', // sidebar borders, darkest shade
  '--t-nav', // inactive nav button background
  '--t-panel', // translucent panel background over the main gradient
  '--t-panel-border', // panel border
  '--t-accent', // theme highlight (title span, active indicators)
  '--t-accent-deep', // pressed / border shade of accent
  '--t-text-soft', // muted text on side/panel surfaces
  '--t-overlay', // modal / match backdrop
]

export const THEMES = {
  cars: {
    id: 'cars',
    label: 'מכוניות',
    subtitle: 'מסלול מרוצים מהיר',
    emoji: '🚗',
    vars: {
      '--t-bg-from': '#fb923c',
      '--t-bg-to': '#b91c1c',
      '--t-side': '#991b1b',
      '--t-side-deep': '#5f1010',
      '--t-nav': '#b91c1c',
      '--t-panel': 'rgba(95, 16, 16, 0.45)',
      '--t-panel-border': '#7f1d1d',
      '--t-accent': '#fde68a',
      '--t-accent-deep': '#fbbf24',
      '--t-text-soft': '#fecaca',
      '--t-overlay': 'rgba(60, 8, 8, 0.94)',
    },
    confetti: ['#ef4444', '#fb923c', '#fde047', '#ffffff', '#0ea5e9', '#111827'],
    particles: ['🚗', '🏁', '🛞', '⚡', '🚦'],
    arcade: {
      catch: { good: '⛽', bad: '🔩', title: 'תדלוק מהיר', he: 'תפסו דלק, תתחמקו מברגים!' },
      flappy: { hero: '🏎️', wall: '#b91c1c', title: 'מכונית מעופפת', he: 'הקישו כדי לעוף בין המחסומים!' },
      breaker: { emoji: '🏁', title: 'שוברים מחסומים', he: 'שברו את כל המחסומים עם הכדור!', bricks: ['#ef4444', '#fb923c', '#fde047', '#f87171', '#fdba74'] },
      whack: { good: '🚗', bad: '🔩', title: 'תפסו את המכונית', he: 'תפסו מכוניות — לא ברגים!' },
    },
    avatarPreset: { hair: 'hair-short-brown', outfit: 'outfit-racer-red', head: 'head-racing-helmet' },
  },
  dinos: {
    id: 'dinos',
    label: 'דינוזאורים',
    subtitle: "יער ענק מלא דינוזאורים",
    emoji: '🦖',
    vars: {
      '--t-bg-from': '#84cc16',
      '--t-bg-to': '#14532d',
      '--t-side': '#166534',
      '--t-side-deep': '#0d3320',
      '--t-nav': '#15803d',
      '--t-panel': 'rgba(13, 51, 32, 0.45)',
      '--t-panel-border': '#166534',
      '--t-accent': '#fde047',
      '--t-accent-deep': '#facc15',
      '--t-text-soft': '#bbf7d0',
      '--t-overlay': 'rgba(8, 40, 24, 0.94)',
    },
    confetti: ['#4ade80', '#a3e635', '#fde047', '#f97316', '#ffffff', '#0d9488'],
    particles: ['🦖', '🦕', '🌴', '🥚', '🌋'],
    arcade: {
      catch: { good: '🥚', bad: '🌋', title: 'איסוף ביצים', he: 'תפסו ביצים, תתחמקו מהרי געש!' },
      flappy: { hero: '🦕', wall: '#166534', title: 'דינו מעופף', he: 'הקישו כדי לעוף בין העצים!' },
      breaker: { emoji: '🦴', title: 'חופרים עצמות', he: 'שברו את כל הסלעים עם הכדור!', bricks: ['#4ade80', '#a3e635', '#fde047', '#65a30d', '#16a34a'] },
      whack: { good: '🦖', bad: '🌋', title: 'תפסו את הדינו', he: 'תפסו דינוזאורים — לא הרי געש!' },
    },
    avatarPreset: { hair: 'hair-spiky-black', outfit: 'outfit-dino-suit', head: 'head-dino-hood' },
  },
  space: {
    id: 'space',
    label: 'חלל',
    subtitle: 'טיסה בין הכוכבים',
    emoji: '🚀',
    vars: {
      '--t-bg-from': '#6366f1',
      '--t-bg-to': '#1e1b4b',
      '--t-side': '#312e81',
      '--t-side-deep': '#1b1745',
      '--t-nav': '#3730a3',
      '--t-panel': 'rgba(27, 23, 69, 0.45)',
      '--t-panel-border': '#312e81',
      '--t-accent': '#c7d2fe',
      '--t-accent-deep': '#818cf8',
      '--t-text-soft': '#c7d2fe',
      '--t-overlay': 'rgba(14, 12, 40, 0.94)',
    },
    confetti: ['#818cf8', '#38bdf8', '#fde047', '#ffffff', '#f472b6', '#22d3ee'],
    particles: ['🚀', '⭐', '🪐', '👽', '🌙'],
    arcade: {
      catch: { good: '⭐', bad: '☄️', title: 'איסוף כוכבים', he: 'תפסו כוכבים, תתחמקו ממטאורים!' },
      flappy: { hero: '🚀', wall: '#4338ca', title: 'חללית בטיסה', he: 'הקישו כדי לעוף בין האסטרואידים!' },
      breaker: { emoji: '🪐', title: 'שוברים מטאורים', he: 'שברו את כל המטאורים עם הכדור!', bricks: ['#818cf8', '#38bdf8', '#a78bfa', '#22d3ee', '#c084fc'] },
      whack: { good: '👽', bad: '☄️', title: 'תפסו את החייזר', he: 'תפסו חייזרים — לא מטאורים!' },
    },
    avatarPreset: { hair: 'hair-short-black', outfit: 'outfit-spacesuit', head: 'head-space-helmet', back: 'back-jetpack' },
  },
}

export const THEME_IDS = Object.keys(THEMES)
export const DEFAULT_THEME = 'cars'
