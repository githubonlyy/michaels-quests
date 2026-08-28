import { describe, it, expect } from 'vitest'
import { ARCADE_GAMES, gameMeta } from '../data/arcadeGames.js'
import { THEMES, THEME_IDS } from '../data/themes.js'

const HEBREW = /[֐-׿]/

describe('arcade catalog', () => {
  it('has exactly the four games in order, catch first and free', () => {
    expect(ARCADE_GAMES.map((g) => g.id)).toEqual(['catch', 'flappy', 'breaker', 'whack'])
    expect(ARCADE_GAMES[0].price).toBe(0)
    expect(ARCADE_GAMES.filter((g) => g.price === 0)).toHaveLength(1)
  })

  it('prices rise with the catalog order', () => {
    const prices = ARCADE_GAMES.map((g) => g.price)
    expect(prices).toEqual([0, 1500, 2000, 2500])
  })

  it('every game has a key that exists in every theme skin map, a component and card colors', () => {
    for (const g of ARCADE_GAMES) {
      expect(typeof g.Component, g.id).toBe('function')
      expect(g.key, g.id).toBeTruthy()
      for (const id of THEME_IDS) {
        expect(THEMES[id].arcade[g.key], `${id} arcade.${g.key}`).toBeDefined()
      }
      for (const cls of ['color', 'borderColor', 'textColor', 'lightBg']) expect(g[cls], `${g.id}.${cls}`).toMatch(/^(bg|border|text)-/)
    }
  })

  it('theme skins carry the sprites each game reads', () => {
    for (const id of THEME_IDS) {
      const a = THEMES[id].arcade
      expect(a.catch.good, `${id} catch.good`).toBeTruthy()
      expect(a.catch.bad, `${id} catch.bad`).toBeTruthy()
      expect(a.flappy.hero, `${id} flappy.hero`).toBeTruthy()
      expect(a.flappy.wall, `${id} flappy.wall`).toMatch(/^#/)
      expect(a.breaker.bricks.length, `${id} breaker.bricks`).toBeGreaterThanOrEqual(3)
      expect(a.whack.good, `${id} whack.good`).toBeTruthy()
      expect(a.whack.bad, `${id} whack.bad`).toBeTruthy()
    }
  })
})

describe('gameMeta', () => {
  it('returns a Hebrew title, description and a card emoji for every theme × game', () => {
    for (const id of THEME_IDS) {
      for (const g of ARCADE_GAMES) {
        const m = gameMeta(g, THEMES[id])
        expect(m.title, `${id}/${g.id} title`).toMatch(HEBREW)
        expect(m.he, `${id}/${g.id} he`).toMatch(HEBREW)
        expect(m.emoji, `${id}/${g.id} emoji`).toBeTruthy()
        expect(m.skin).toBe(THEMES[id].arcade[g.key])
      }
    }
  })

  it('titles differ between themes (the skin really changes the game)', () => {
    for (const g of ARCADE_GAMES) {
      const titles = new Set(THEME_IDS.map((id) => gameMeta(g, THEMES[id]).title))
      expect(titles.size, g.id).toBe(THEME_IDS.length)
    }
  })

  it('falls back to the game icon when a theme is missing', () => {
    const m = gameMeta(ARCADE_GAMES[0], null)
    expect(m.title).toBe('catch')
    expect(m.emoji).toBe(ARCADE_GAMES[0].icon)
  })
})
