// Trophy definitions. `check(state)` runs against the freshly-updated player
// state inside the reducer; a trophy is earned once and keeps its timestamp.
export const TROPHIES = [
  {
    id: 'first-win',
    icon: 'trophy',
    title: 'ניצחון ראשון',
    he: 'הניצחון הראשון שלך!',
    check: (s) => s.stats.totalWins >= 1,
  },
  {
    id: 'perfect',
    icon: 'target',
    title: 'מושלם!',
    he: 'משחק מושלם — בלי אף טעות!',
    check: (s) => s.stats.perfectCount >= 1,
  },
  {
    id: 'streak-3',
    icon: 'flame',
    title: '3 ימים ברצף',
    he: 'שיחקת 3 ימים ברצף!',
    check: (s) => s.streak.best >= 3,
  },
  {
    id: 'streak-7',
    icon: 'crown',
    title: 'שבוע שלם',
    he: 'שבוע שלם ברצף!',
    check: (s) => s.streak.best >= 7,
  },
  {
    id: 'master-counting',
    icon: 'hash',
    title: 'סופר גדול',
    he: '5 ניצחונות בספירה',
    check: (s) => (s.stats.winsBySubject.counting || 0) >= 5,
  },
  {
    id: 'master-colors',
    icon: 'palette',
    title: 'אלוף הצבעים',
    he: '5 ניצחונות בצבעים',
    check: (s) => (s.stats.winsBySubject.colors || 0) >= 5,
  },
  {
    id: 'master-shapes',
    icon: 'shapes',
    title: 'אלוף הצורות',
    he: '5 ניצחונות בצורות',
    check: (s) => (s.stats.winsBySubject.shapes || 0) >= 5,
  },
  {
    id: 'master-letters',
    icon: 'letters',
    title: 'אלוף האותיות',
    he: '5 ניצחונות באותיות',
    check: (s) => (s.stats.winsBySubject.letters || 0) >= 5,
  },
  {
    id: 'master-compare',
    icon: 'scale',
    title: 'גדול וקטן',
    he: '5 ניצחונות בגדול וקטן',
    check: (s) => (s.stats.winsBySubject.compare || 0) >= 5,
  },
  {
    id: 'master-match',
    icon: 'puzzle',
    title: 'אלוף ההתאמות',
    he: '5 ניצחונות בהתאמה',
    check: (s) => (s.stats.winsBySubject.match || 0) >= 5,
  },
  {
    id: 'rich',
    icon: 'coins',
    title: 'עשיר!',
    he: 'הגעת ל-1,000 מטבעות!',
    check: (s) => s.coins >= 1000,
  },
  {
    id: 'stylist',
    icon: 'shirt',
    title: 'אלוף האופנה',
    he: 'קנית 5 בגדים לארון!',
    check: (s) => s.avatar.owned.length >= 5 + 4, // 4 free starter items
  },
  {
    id: 'shopper',
    icon: 'bag',
    title: 'פרס אמיתי',
    he: 'הפרס האמיתי הראשון שלך!',
    check: (s) => s.purchases.some((p) => p.kind === 'reward'),
  },
  {
    id: 'chest-hunter',
    icon: 'gift',
    title: 'צייד אוצרות',
    he: 'פתחת את תיבת האוצר היומית!',
    check: (s) => s.stats.chestsOpened >= 1,
  },
]

// returns an updated {id: ts} map including any newly-earned trophies
export function evaluateTrophies(state) {
  let changed = false
  const next = { ...state.trophies }
  for (const t of TROPHIES) {
    if (!next[t.id] && t.check(state)) {
      next[t.id] = Date.now()
      changed = true
    }
  }
  return changed ? next : state.trophies
}
