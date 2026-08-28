import { describe, it, expect } from 'vitest'
import letters from '../data/questions/letters.json'
import colors from '../data/questions/colors.json'
import counting from '../data/questions/counting.json'
import match from '../data/questions/match.json'
import shapes from '../data/questions/shapes.json'
import compare from '../data/questions/compare.json'
import vehicles from '../data/questions/vehicles.json'
import sounds from '../data/questions/sounds.json'
import digits from '../data/questions/digits.json'
import opposites from '../data/questions/opposites.json'
import { EVENTS } from '../data/events.js'

const BANKS = { letters, colors, counting, match, shapes, compare, vehicles, sounds, digits, opposites }
const HEBREW_LETTERS = 'אבגדהוזחטיכלמנסעפצקרשתךםןףץ'
// the eight shapes a four-year-old is asked for (BigTiles knows more)
const SHAPE_NAMES = ['circle', 'square', 'triangle', 'star', 'heart', 'rectangle', 'oval', 'diamond']
const HEX = /^#[0-9a-f]{6}$/i

// 4 options, unique, containing the answer exactly once
function expectOptions(options, answer, label) {
  expect(options, label).toHaveLength(4)
  expect(new Set(options).size, `${label} options unique`).toBe(4)
  expect(options.filter((o) => o === answer), `${label} answer once`).toHaveLength(1)
}

describe('question banks — shared rules', () => {
  it('every event has a bank with at least 30 items', () => {
    for (const e of EVENTS) {
      expect(BANKS[e.id], e.id).toBeDefined()
      expect(BANKS[e.id].length, e.id).toBeGreaterThanOrEqual(30)
    }
  })

  it('every item has a non-empty speak and answerSpeak string', () => {
    for (const [name, bank] of Object.entries(BANKS)) {
      bank.forEach((q, i) => {
        expect(typeof q.speak, `${name}[${i}]`).toBe('string')
        expect(q.speak.trim().length, `${name}[${i}] speak`).toBeGreaterThan(0)
        expect(typeof q.answerSpeak, `${name}[${i}] answerSpeak`).toBe('string')
        expect(q.answerSpeak.length, `${name}[${i}] answerSpeak`).toBeGreaterThan(0)
      })
    }
  })
})

describe('letters.json', () => {
  it('items are hear/first with a Hebrew letter answer and 4 unique options', () => {
    letters.forEach((q, i) => {
      expect(['hear', 'first'], `letters[${i}] kind`).toContain(q.kind)
      expect(HEBREW_LETTERS.includes(q.letter), `letters[${i}] letter ${q.letter}`).toBe(true)
      expectOptions(q.options, q.letter, `letters[${i}]`)
      for (const o of q.options) expect(HEBREW_LETTERS.includes(o), `letters[${i}] option ${o}`).toBe(true)
      if (q.kind === 'first') {
        expect(q.emoji, `letters[${i}] emoji`).toBeTruthy()
        expect(q.word, `letters[${i}] word`).toBeTruthy()
        expect(q.word[0], `letters[${i}] word starts with letter`).toBe(q.letter)
      } else {
        expect(q.name, `letters[${i}] name`).toBeTruthy()
      }
    })
  })

  it('covers all 22 base letters + 5 final forms in hear mode', () => {
    const heard = new Set(letters.filter((q) => q.kind === 'hear').map((q) => q.letter))
    for (const ch of HEBREW_LETTERS) expect(heard.has(ch), `hear ${ch}`).toBe(true)
  })

  it('picture items use distinct emojis and there are at least 20', () => {
    const firsts = letters.filter((q) => q.kind === 'first')
    expect(firsts.length).toBeGreaterThanOrEqual(20)
    expect(new Set(firsts.map((q) => q.emoji)).size).toBe(firsts.length)
  })
})

describe('colors.json', () => {
  it('asks for a hex that sits in 4 unique hex options, with a Hebrew name', () => {
    colors.forEach((q, i) => {
      expect(['swatch', 'object'], `colors[${i}] kind`).toContain(q.kind)
      expect(q.ask, `colors[${i}] ask`).toMatch(HEX)
      expectOptions(q.options, q.ask, `colors[${i}]`)
      for (const o of q.options) expect(o, `colors[${i}] option ${o}`).toMatch(HEX)
      expect(/[֐-׿]/.test(q.name), `colors[${i}] name`).toBe(true)
      if (q.kind === 'object') expect(q.emoji, `colors[${i}] emoji`).toBeTruthy()
    })
  })

  it('covers at least 10 different colors and asks about real objects too', () => {
    expect(new Set(colors.map((q) => q.ask)).size).toBeGreaterThanOrEqual(10)
    expect(colors.filter((q) => q.kind === 'object').length).toBeGreaterThanOrEqual(15)
  })
})

describe('shapes.json', () => {
  it('shape items use known shapes; pattern items have seq/answer/options', () => {
    shapes.forEach((q, i) => {
      expect(['shape', 'pattern'], `shapes[${i}] kind`).toContain(q.kind)
      if (q.kind === 'shape') {
        expect(SHAPE_NAMES, `shapes[${i}] ask`).toContain(q.ask)
        expectOptions(q.options, q.ask, `shapes[${i}]`)
        for (const o of q.options) expect(SHAPE_NAMES, `shapes[${i}] option ${o}`).toContain(o)
      } else {
        expect(Array.isArray(q.seq) && q.seq.length >= 4, `shapes[${i}] seq`).toBe(true)
        // A B A B — the next tile repeats the first one
        expect(q.answer, `shapes[${i}] answer`).toBe(q.seq[0])
        expectOptions(q.options, q.answer, `shapes[${i}]`)
      }
    })
  })

  it('every asked shape is one of the eight, and each is asked at least once', () => {
    const asked = new Set(shapes.filter((q) => q.kind === 'shape').map((q) => q.ask))
    for (const s of SHAPE_NAMES) expect(asked.has(s), s).toBe(true)
  })
})

describe('counting.json', () => {
  it('n stays inside 1..10 — gan counting, with an emoji to count', () => {
    counting.forEach((q, i) => {
      expect(Number.isInteger(q.n), `counting[${i}]`).toBe(true)
      expect(q.n, `counting[${i}] n`).toBeGreaterThanOrEqual(1)
      expect(q.n, `counting[${i}] n`).toBeLessThanOrEqual(10)
      expect(q.emoji, `counting[${i}] emoji`).toBeTruthy()
    })
  })
})

describe('compare.json', () => {
  it('count items: piles of 1..6, at least 2 apart, spoken side matches', () => {
    compare.filter((q) => q.kind === 'count').forEach((q, i) => {
      expect(['more', 'less'], `compare count[${i}] ask`).toContain(q.ask)
      for (const side of ['left', 'right']) {
        expect(q[side].emoji, `compare count[${i}] ${side}`).toBeTruthy()
        expect(q[side].n).toBeGreaterThanOrEqual(1)
        expect(q[side].n).toBeLessThanOrEqual(6)
      }
      expect(Math.abs(q.left.n - q.right.n), `compare count[${i}] gap`).toBeGreaterThanOrEqual(2)
      const leftWins = (q.ask === 'more') === (q.left.n > q.right.n)
      expect(q.answerSpeak).toBe(leftWins ? 'בצד שמאל' : 'בצד ימין')
    })
  })

  it('number items: 1..9, at least 2 apart, ask bigger|smaller, spoken side matches', () => {
    compare.filter((q) => q.kind === 'number').forEach((q, i) => {
      expect(['bigger', 'smaller'], `compare number[${i}] ask`).toContain(q.ask)
      for (const v of [q.a, q.b]) {
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(9)
      }
      expect(Math.abs(q.a - q.b), `compare number[${i}] gap`).toBeGreaterThanOrEqual(2)
      const leftWins = (q.ask === 'bigger') === (q.a > q.b)
      expect(q.answerSpeak).toBe(leftWins ? 'בצד שמאל' : 'בצד ימין')
    })
  })

  it('has both kinds', () => {
    expect(compare.some((q) => q.kind === 'count')).toBe(true)
    expect(compare.some((q) => q.kind === 'number')).toBe(true)
  })
})

describe('vehicles.json', () => {
  it('answers a who/where question with one of four unique vehicles', () => {
    vehicles.forEach((q, i) => {
      expect(['who', 'where'], `vehicles[${i}] kind`).toContain(q.kind)
      expect(q.answer, `vehicles[${i}] answer`).toBeTruthy()
      expectOptions(q.options, q.answer, `vehicles[${i}]`)
      expect(q.speak.endsWith('?'), `vehicles[${i}] speak is a question`).toBe(true)
    })
  })

  it('covers both kinds and at least a dozen different vehicles', () => {
    expect(vehicles.some((q) => q.kind === 'who')).toBe(true)
    expect(vehicles.some((q) => q.kind === 'where')).toBe(true)
    expect(new Set(vehicles.map((q) => q.answer)).size).toBeGreaterThanOrEqual(12)
  })
})

describe('sounds.json', () => {
  it('every item carries a spoken sound and four unique animals', () => {
    sounds.forEach((q, i) => {
      expect(q.sound, `sounds[${i}] sound`).toBeTruthy()
      expect(q.speak, `sounds[${i}] speak repeats the sound`).toContain(q.sound)
      expectOptions(q.options, q.answer, `sounds[${i}]`)
    })
  })

  it('no two items share a sound', () => {
    expect(new Set(sounds.map((q) => q.sound)).size).toBe(sounds.length)
  })
})

describe('digits.json', () => {
  it('asks for a numeral 0..10 among four unique numerals', () => {
    digits.forEach((q, i) => {
      expect(['hear', 'dots'], `digits[${i}] kind`).toContain(q.kind)
      expect(Number(q.digit), `digits[${i}] digit`).toBeGreaterThanOrEqual(0)
      expect(Number(q.digit), `digits[${i}] digit`).toBeLessThanOrEqual(10)
      expectOptions(q.options, q.digit, `digits[${i}]`)
      for (const o of q.options) expect(o, `digits[${i}] option ${o}`).toMatch(/^\d{1,2}$/)
      if (q.kind === 'dots') {
        expect(q.n, `digits[${i}] dots count`).toBe(Number(q.digit))
        expect(q.n).toBeGreaterThanOrEqual(1)
        expect(q.n).toBeLessThanOrEqual(10)
        expect(q.emoji, `digits[${i}] emoji`).toBeTruthy()
      }
    })
  })

  it('every numeral 0..10 is asked, and the dots kind covers 1..10', () => {
    const asked = new Set(digits.map((q) => q.digit))
    for (let n = 0; n <= 10; n++) expect(asked.has(String(n)), `digit ${n}`).toBe(true)
    const dotted = new Set(digits.filter((q) => q.kind === 'dots').map((q) => q.n))
    for (let n = 1; n <= 10; n++) expect(dotted.has(n), `dots ${n}`).toBe(true)
  })
})

describe('opposites.json', () => {
  it('shows one picture and offers its opposite among four', () => {
    opposites.forEach((q, i) => {
      expect(q.emoji, `opposites[${i}] emoji`).toBeTruthy()
      expect(q.answer, `opposites[${i}] answer`).not.toBe(q.emoji)
      expect(q.options, `opposites[${i}] never offers the prompt itself`).not.toContain(q.emoji)
      expectOptions(q.options, q.answer, `opposites[${i}]`)
    })
  })

  it('pairs run both ways — every prompt is also asked as an answer', () => {
    const pairs = new Set(opposites.map((q) => `${q.emoji}->${q.answer}`))
    for (const q of opposites) expect(pairs.has(`${q.answer}->${q.emoji}`), `${q.answer} back to ${q.emoji}`).toBe(true)
  })
})

describe('match.json', () => {
  it('pairs two emojis, both sides unique across the bank', () => {
    match.forEach((q, i) => {
      expect(q.emoji, `match[${i}] emoji`).toBeTruthy()
      expect(q.match, `match[${i}] match`).toBeTruthy()
      expect(q.emoji, `match[${i}] not itself`).not.toBe(q.match)
    })
    expect(new Set(match.map((q) => q.emoji)).size, 'prompts unique').toBe(match.length)
    expect(new Set(match.map((q) => q.match)).size, 'answers unique').toBe(match.length)
  })

  it('no answer emoji doubles as a prompt (decoys would be ambiguous)', () => {
    const prompts = new Set(match.map((q) => q.emoji))
    for (const q of match) expect(prompts.has(q.match), `${q.match} used on both sides`).toBe(false)
  })
})
