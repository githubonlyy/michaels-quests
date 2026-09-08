import { describe, it, expect } from 'vitest'
import {
  toGray,
  boxBlurGray,
  boxBlurF32,
  backgroundField,
  flatField,
  paperLevel,
  autoTrimBounds,
  paperIsIsland,
  paperCutoff,
  clearOffPaper,
  adaptiveCuts,
  keyToAlpha,
  processPage,
  PAPER_CUT,
  INK_CUT,
  TRIM_MAX,
  TRIM_SAFE,
  TRIM_MIN_PAPER,
  TRIM_PAPER_FRAC,
} from '../world/draw/pageInk.js'
import { pageMetaFromPath, pagesFromGlob, loadPageModes, savePageMode, MODE_OPACITY } from '../world/draw/familyPages.js'

/** ImageData-shaped buffer from a (x,y) -> [r,g,b] function */
function make(width, height, fn) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fn(x, y)
      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return { data, width, height }
}

/**
 * Stand-in for the reference photo: a printed coloring page shot on a table —
 * cream paper, a lighting gradient across it, black pen strokes, and the dark
 * table visible along the top and left edges.
 */
function photographedPage(w = 220, h = 300) {
  const bandTop = Math.round(h * 0.06)
  const bandLeft = Math.round(w * 0.05)
  return make(w, h, (x, y) => {
    if (y < bandTop || x < bandLeft) return [92, 68, 48] // wooden table
    // cream paper, brighter top-left, dimmer bottom-right
    const shade = 1 - 0.22 * ((x / w) * 0.5 + (y / h) * 0.5)
    const paper = [242 * shade, 237 * shade, 228 * shade]
    // strokes: a border box and a diagonal, 2px wide
    const inBox =
      (Math.abs(x - w * 0.25) < 1.5 || Math.abs(x - w * 0.75) < 1.5) && y > h * 0.25 && y < h * 0.75
    const inRule = Math.abs((y - h * 0.25) - (x - w * 0.25)) < 1.5 && x > w * 0.25 && x < w * 0.75
    return inBox || inRule ? [28, 26, 24] : paper
  })
}

/**
 * What a phone actually produces: the page lands in the MIDDLE of the frame,
 * filling about 55% of it, with desk all round — not edge to edge. `tilt` puts
 * the page on a slight angle, the way it lands on a table.
 *
 * `desk` is the table's luminance (the default is dark stained wood) and `grain`
 * the amplitude of its texture, ± that many levels. Both matter: the pale table
 * is the hard case, and a table with grain in it is the one that used to key
 * black. The grain comes from a fixed generator so a failure repeats exactly.
 */
const FRAME = { w: 300, h: 400, fill: 0.55 }
function pageInFrame({ w = FRAME.w, h = FRAME.h, fill = FRAME.fill, tilt = 0, desk = [58, 44, 34], grain = 0 } = {}) {
  const pw = w * fill
  const ph = h * fill
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const t = (tilt * Math.PI) / 180
  const cos = Math.cos(t)
  const sin = Math.sin(t)
  let seed = 1
  const noise = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return ((seed / 0x7fffffff) * 2 - 1) * grain
  }
  return make(w, h, (x, y) => {
    const dx = x - cx
    const dy = y - cy
    const px = dx * cos + dy * sin // into the page's own frame
    const py = -dx * sin + dy * cos
    if (Math.abs(px) > pw / 2 || Math.abs(py) > ph / 2) {
      const n = grain ? noise() : 0
      return [desk[0] + n, desk[1] + n, desk[2] + n]
    }
    const shade = 1 - 0.18 * ((px / pw + 0.5) * 0.5 + (py / ph + 0.5) * 0.5)
    const ink =
      (Math.abs(px) < 1.5 && Math.abs(py) < ph * 0.3) || (Math.abs(py) < 1.5 && Math.abs(px) < pw * 0.3)
    return ink ? [26, 26, 24] : [243 * shade, 238 * shade, 229 * shade]
  })
}
/** the same table, as a flat grey of the given luminance */
const greyDesk = (v) => [v, v, v]
/** where the paper really is in that frame */
const framePaper = ({ w = FRAME.w, h = FRAME.h, fill = FRAME.fill } = {}) => ({
  left: Math.round((w - 1) / 2 - (w * fill) / 2),
  top: Math.round((h - 1) / 2 - (h * fill) / 2),
})

/**
 * The other kind of page: a full-bleed scan, paper running off all four edges,
 * with a solid title band inked right to the top one. The band is not paper, so
 * it falls outside the paper's bounding box and the trim would like to eat it —
 * but it is somebody's artwork, not a desk.
 */
function bleedPage({ w = 240, h = 320, band = 0.3 } = {}) {
  const bandH = Math.round(h * band)
  return make(w, h, (x, y) => {
    if (y < bandH) return [18, 18, 18]
    const onLine = Math.abs(x - w * 0.5) < 2 || Math.abs(y - h * 0.7) < 2
    return onLine ? [24, 24, 22] : [246, 244, 240]
  })
}

/** A page with a solid filled shape on it — black hair, a title bar, a thick frame. */
function filledShape(w = 320, h = 320, side = 170) {
  const lo = Math.round((w - side) / 2)
  const hi = lo + side - 1
  return make(w, h, (x, y) => (x >= lo && x <= hi && y >= lo && y <= hi ? [22, 20, 20] : [245, 243, 238]))
}

const alphaAt = (out, x, y) => out.data[(y * out.width + x) * 4 + 3]
/**
 * How much of a frame reads as paper — what TRIM_MIN_PAPER is measured against.
 * Counted straight off the pixels, where autoTrimBounds takes a neighbourhood
 * vote first, so this is close to but not exactly the guard's own number.
 */
function paperArea(img) {
  const gray = toGray(img)
  const cut = paperCutoff(gray, img.width, img.height)
  let n = 0
  for (let i = 0; i < gray.length; i++) if (gray[i] >= cut) n++
  return n / gray.length
}
function opaqueFraction(out, over = 128) {
  let n = 0
  for (let i = 3; i < out.data.length; i += 4) if (out.data[i] > over) n++
  return n / (out.width * out.height)
}

describe('boxBlurGray', () => {
  it('leaves a flat field flat', () => {
    const g = new Uint8ClampedArray(40 * 40).fill(180)
    const out = boxBlurGray(g, 40, 40, 4)
    expect([...out].every((v) => Math.abs(v - 180) <= 1)).toBe(true)
  })

  it('spreads an impulse and conserves brightness order', () => {
    const g = new Uint8ClampedArray(21 * 21)
    g[10 * 21 + 10] = 255
    const out = boxBlurGray(g, 21, 21, 3)
    expect(out[10 * 21 + 10]).toBeGreaterThan(0)
    expect(out[10 * 21 + 10]).toBeLessThan(255)
    // compare against a pixel outside the kernel (radius 3), not inside it
    expect(out[10 * 21 + 10]).toBeGreaterThan(out[10 * 21 + 18])
  })

  it('radius 0 is a copy', () => {
    const g = Uint8ClampedArray.from({ length: 25 }, (_, i) => i * 10)
    expect([...boxBlurGray(g, 5, 5, 0)]).toEqual([...g])
  })
})

describe('flatField', () => {
  it('flattens a lighting gradient on blank paper', () => {
    const w = 120
    const h = 120
    const img = make(w, h, (x) => {
      const v = 240 - (x / w) * 60 // bright left, dim right
      return [v, v - 4, v - 10]
    })
    const flat = flatField(toGray(img), w, h)
    const mid = []
    for (let x = 10; x < w - 10; x++) mid.push(flat[60 * w + x])
    const min = Math.min(...mid)
    const max = Math.max(...mid)
    expect(max - min).toBeLessThan(0.03) // uniform after correction
    expect(min).toBeGreaterThan(PAPER_CUT) // and reads as paper
  })

  it('keeps thin dark strokes dark', () => {
    const w = 120
    const h = 120
    const img = make(w, h, (x) => (Math.abs(x - 60) < 1.5 ? [20, 20, 20] : [235, 232, 224]))
    const flat = flatField(toGray(img), w, h)
    expect(flat[60 * w + 60]).toBeLessThan(0.3)
    expect(flat[60 * w + 20]).toBeGreaterThan(PAPER_CUT)
  })
})

describe('paperLevel', () => {
  it('finds the bright mode of cream paper', () => {
    const img = photographedPage()
    const level = paperLevel(toGray(img))
    expect(level).toBeGreaterThan(150)
    expect(level).toBeLessThan(256)
  })
})

describe('autoTrimBounds', () => {
  it('crops the table band off a photographed page', () => {
    const img = photographedPage()
    const b = autoTrimBounds(toGray(img), img.width, img.height)
    expect(b.top).toBeGreaterThan(0)
    expect(b.left).toBeGreaterThan(0)
    expect(b.width).toBeLessThan(img.width)
  })

  it('never trims more than the cap, even on an all-dark image', () => {
    const w = 100
    const h = 100
    const dark = make(w, h, () => [20, 20, 20])
    const b = autoTrimBounds(toGray(dark), w, h)
    expect(b.top).toBeLessThanOrEqual(Math.floor(h * 0.15))
    expect(b.left).toBeLessThanOrEqual(Math.floor(w * 0.15))
    expect(b.width).toBeGreaterThan(w * 0.7)
  })

  it('leaves a clean page untouched', () => {
    const w = 80
    const h = 80
    const clean = make(w, h, () => [252, 252, 250])
    const b = autoTrimBounds(toGray(clean), w, h)
    expect(b).toMatchObject({ left: 0, top: 0, width: w, height: h })
  })
})

describe('keyToAlpha', () => {
  it('paper becomes transparent, ink becomes opaque black', () => {
    const w = 4
    const h = 1
    const flat = new Float32Array([1, 0.95, 0.5, 0.2])
    const { data } = keyToAlpha(flat, w, h)
    expect(data[3]).toBe(0) // pure white -> transparent
    expect(data[7]).toBe(0) // above paperCut -> transparent
    expect(data[11]).toBe(255) // below inkCut -> solid
    expect(data[15]).toBe(255)
    expect([data[8], data[9], data[10]]).toEqual([0, 0, 0]) // colour forced black
  })

  it('ramps mid-tones instead of clipping them', () => {
    const flat = new Float32Array([(0.86 + 0.62) / 2])
    const { data } = keyToAlpha(flat, 1, 1)
    expect(data[3]).toBeGreaterThan(100)
    expect(data[3]).toBeLessThan(160)
  })
})

describe('processPage on a photographed page', () => {
  const img = photographedPage()
  const out = processPage(img)

  it('trims the table and returns a smaller page', () => {
    expect(out.width).toBeLessThan(img.width)
    expect(out.height).toBeLessThan(img.height)
    expect(out.bounds.top).toBeGreaterThan(0)
  })

  it('makes the cream paper fully transparent', () => {
    // sample well inside the page, away from the strokes
    const at = (x, y) => out.data[(y * out.width + x) * 4 + 3]
    expect(at(Math.round(out.width * 0.5), Math.round(out.height * 0.1))).toBe(0)
    expect(at(Math.round(out.width * 0.9), Math.round(out.height * 0.9))).toBe(0)
  })

  it('keeps the strokes as opaque black ink', () => {
    let inked = 0
    for (let i = 3; i < out.data.length; i += 4) if (out.data[i] > 200) inked++
    expect(inked).toBeGreaterThan(100) // the strokes survived
    const ratio = inked / (out.width * out.height)
    expect(ratio).toBeLessThan(0.2) // but the page did not go black
  })

  it('every opaque pixel is black, not tinted', () => {
    for (let i = 0; i < out.data.length; i += 4) {
      if (out.data[i + 3] > 0) {
        expect(out.data[i]).toBe(0)
        expect(out.data[i + 1]).toBe(0)
        expect(out.data[i + 2]).toBe(0)
      }
    }
  })
})

describe('boxBlurF32', () => {
  it('keeps the fractions a mask blur is made of', () => {
    const mask = new Float32Array(9 * 9)
    for (let y = 0; y < 9; y++) for (let x = 0; x < 5; x++) mask[y * 9 + x] = 1
    const out = boxBlurF32(mask, 9, 9, 2)
    const edge = out[4 * 9 + 4] // half in the mask, half out
    expect(edge).toBeGreaterThan(0.2)
    expect(edge).toBeLessThan(0.8)
    expect(out[4 * 9 + 0]).toBeCloseTo(1, 5) // deep inside is still fully supported
  })
})

describe('backgroundField', () => {
  // A mean of everything is BLACK in the middle of a filled shape, so the shape
  // divides itself back to white and keys to transparent. The estimate has to
  // stay at the paper's level there instead.
  it('does not follow the ink into the middle of a filled shape', () => {
    const img = filledShape()
    const gray = toGray(img)
    const bg = backgroundField(gray, img.width, img.height)
    const centre = bg[Math.round(img.height / 2) * img.width + Math.round(img.width / 2)]
    expect(centre).toBeGreaterThan(200) // the paper is ~244; the ink is 20
  })

  it('still follows a lighting gradient across blank paper', () => {
    const w = 160
    const h = 160
    const img = make(w, h, (x) => {
      const v = 240 - (x / w) * 60
      return [v, v - 4, v - 10]
    })
    const bg = backgroundField(toGray(img), w, h)
    expect(bg[80 * w + 10]).toBeGreaterThan(bg[80 * w + w - 10] + 30) // bright end vs dim end
  })
})

describe('a filled shape keeps its inside', () => {
  const img = filledShape()
  const out = processPage(img)
  const side = 170
  const lo = Math.round((img.width - side) / 2)
  const hi = lo + side - 1

  it('is solid in the middle, not a ring with a hole in it', () => {
    expect(alphaAt(out, Math.round(img.width / 2), Math.round(img.height / 2))).toBe(255)
  })

  it('is solid EVERYWHERE inside, not just near its edge', () => {
    let weakest = 255
    for (let y = lo + 4; y <= hi - 4; y++) {
      for (let x = lo + 4; x <= hi - 4; x++) weakest = Math.min(weakest, alphaAt(out, x, y))
    }
    expect(weakest).toBe(255)
  })

  it('leaves the paper around it transparent', () => {
    expect(alphaAt(out, 10, 10)).toBe(0)
    expect(alphaAt(out, img.width - 10, 10)).toBe(0)
  })
})

describe('a page that fills only the middle of the frame', () => {
  const img = pageInFrame()
  const paper = framePaper()
  const cap = Math.floor(FRAME.w * 0.15) // what the old 15% cap allowed

  it('trims all the way to the paper, far past the old 15% cap', () => {
    const b = autoTrimBounds(toGray(img), img.width, img.height)
    expect(cap).toBeLessThan(paper.left) // the fixture really does need more than 15%
    expect(b.left).toBeGreaterThan(cap)
    expect(Math.abs(b.left - paper.left)).toBeLessThanOrEqual(2)
    expect(Math.abs(b.top - paper.top)).toBeLessThanOrEqual(2)
    expect(b.width).toBeLessThanOrEqual(Math.round(FRAME.w * FRAME.fill) + 2)
  })

  it('leaves no black band of desk behind', () => {
    const out = processPage(img)
    expect(opaqueFraction(out)).toBeLessThan(0.03) // the strokes are well under 1%
  })

  it('keeps a tilted page whole instead of stopping at the first clipped corner', () => {
    const tilted = pageInFrame({ tilt: 3 })
    const b = autoTrimBounds(toGray(tilted), tilted.width, tilted.height)
    // a tilted page reaches FURTHER out than a straight one, and the box has to
    // hold all of it — but still nowhere near the whole frame
    expect(b.left).toBeGreaterThan(cap)
    expect(b.left).toBeLessThan(paper.left)
    expect(b.top).toBeLessThan(paper.top)
    expect(b.width).toBeLessThan(FRAME.w * 0.7)
    expect(opaqueFraction(processPage(tilted))).toBeLessThan(0.05)
  })

  it('leaves a dark drawing whole when there is barely any paper in the frame', () => {
    // not a photographed page at all — a drawing that happens to be dark, and
    // the safety net could only chew 35% off each side of it
    const w = 120
    const h = 120
    const dark = make(w, h, (x, y) => (x > 90 && y > 90 ? [245, 245, 240] : [30, 28, 28]))
    expect(autoTrimBounds(toGray(dark), w, h)).toMatchObject({ left: 0, top: 0, width: w, height: h })
  })

  it('still refuses to eat more than the cap when there is no paper at all', () => {
    const w = 100
    const h = 100
    const dark = make(w, h, () => [20, 20, 20])
    const b = autoTrimBounds(toGray(dark), w, h)
    expect(b.left).toBeLessThanOrEqual(Math.floor(w * TRIM_MAX))
    expect(b.width).toBeGreaterThan(w * (1 - 2 * TRIM_MAX))
  })
})

// REGRESSION: a page photographed on a LIGHT table. paperLevel took the tallest
// histogram peak, which on a pale table is the table — it is most of the frame
// and lands in one bin, while the shaded paper is spread over forty. Everything
// downstream then measured itself against furniture: 99.6% of the frame counted
// as "paper" so the trim cropped nothing at all at any page size, and a table
// with grain in it keyed as solid ink — a quarter of his sheet came out black.
describe('a page photographed on a light table', () => {
  const truePaper = { left: 67, top: 90, width: 166, height: 220 }

  it('reads the paper level off the paper, not off the table', () => {
    for (const v of [58, 120, 150, 170, 190]) {
      const paper = paperLevel(toGray(pageInFrame({ desk: greyDesk(v) })))
      expect(paper).toBeGreaterThan(200) // the page is 217ish; the tables are not
    }
  })

  it('finds the page on a pale table, at every page size', () => {
    for (const fill of [0.9, 0.7, 0.55, 0.4]) {
      const b = autoTrimBounds(toGray(pageInFrame({ fill, desk: greyDesk(150) })), FRAME.w, FRAME.h)
      expect(b.trusted).toBe(true)
      expect(b.island).toBe(true)
      expect(b.width).toBeLessThan(FRAME.w) // it used to return the whole frame every time
      expect(Math.abs(b.left - framePaper({ fill }).left)).toBeLessThanOrEqual(2)
      expect(Math.abs(b.top - framePaper({ fill }).top)).toBeLessThanOrEqual(2)
    }
  })

  it('is not fooled by the grain in the table', () => {
    // Single specks of grain crossing the paper threshold used to be strung
    // together by the gap-bridging in paperRuns and drag the box out over the
    // table; the table inside the crop then keyed black.
    for (const v of [120, 150, 170]) {
      for (const grain of [0, 4, 8, 15, 25]) {
        const img = pageInFrame({ desk: greyDesk(v), grain })
        const b = autoTrimBounds(toGray(img), FRAME.w, FRAME.h)
        expect({ desk: v, grain, ...b }).toMatchObject({ desk: v, grain, ...truePaper })
        expect(opaqueFraction(processPage(img))).toBeLessThan(0.05) // was up to 0.31
      }
    }
  })
})

describe('paperCutoff', () => {
  it('leaves the plain cut alone when the table is dark', () => {
    const gray = toGray(pageInFrame())
    expect(paperCutoff(gray, FRAME.w, FRAME.h)).toBeCloseTo(paperLevel(gray) * TRIM_PAPER_FRAC, 6)
  })

  it('drops the cut into the valley when the table is nearly as light as the page', () => {
    const gray = toGray(pageInFrame({ desk: greyDesk(170) }))
    const plain = paperLevel(gray) * TRIM_PAPER_FRAC
    const cut = paperCutoff(gray, FRAME.w, FRAME.h)
    expect(cut).toBeGreaterThan(plain) // 156 does not separate 170 from 217
    expect(cut).toBeGreaterThan(170) // above the table...
    expect(cut).toBeLessThan(199) // ...and below the dimmest corner of the page
  })

  it('will not tighten onto a pale area of the drawing itself', () => {
    // Same two-hump histogram, but the second hump is a grey wash ON the page,
    // which reaches the edge of the picture: not a table, so the cut must stay
    // where it was or the wash gets cropped off the drawing.
    const w = 300
    const h = 300
    const wash = make(w, h, (x, y) => (y > h * 0.55 ? [176, 176, 172] : [243, 241, 236]))
    const gray = toGray(wash)
    expect(paperCutoff(gray, w, h)).toBeCloseTo(paperLevel(gray) * TRIM_PAPER_FRAC, 6)
  })
})

describe('paperIsIsland', () => {
  const cut = 176

  it('sees frame all round a page photographed on a desk', () => {
    expect(paperIsIsland(toGray(pageInFrame({ fill: 0.25 })), FRAME.w, FRAME.h, cut)).toBe(true)
  })

  it('says no when the paper runs off the edge of the picture', () => {
    // the dark drawing: its paper reaches the corner of the frame, so the dark
    // parts are artwork, not furniture
    const w = 120
    const h = 120
    const dark = make(w, h, (x, y) => (x > 90 && y > 90 ? [245, 245, 240] : [30, 28, 28]))
    expect(paperIsIsland(toGray(dark), w, h, cut)).toBe(false)
  })

  it('is not flipped by a highlight on the table edge', () => {
    // measured against the PAPER, not against the border, so a few bright pixels
    // at the edge of the frame cannot turn a page into a drawing
    const img = pageInFrame({ fill: 0.25 })
    for (let x = 20; x < 60; x++) {
      for (let y = 0; y < 3; y++) {
        const i = (y * FRAME.w + x) * 4
        img.data[i] = 244
        img.data[i + 1] = 242
        img.data[i + 2] = 236
      }
    }
    expect(paperIsIsland(toGray(img), FRAME.w, FRAME.h, cut)).toBe(true)
  })

  it('says no when there is no paper at all', () => {
    const dark = make(40, 40, () => [20, 20, 20])
    expect(paperIsIsland(toGray(dark), 40, 40, cut)).toBe(false)
  })
})

// REGRESSION: a photo taken from a distance keyed to a near-solid black sheet.
// Under TRIM_MIN_PAPER the trim keeps the whole frame, and a paper-only
// background then hands the DESK the page's paper level — the desk divides to
// about 0.16 and keys as solid ink. Measured over this sweep, the opaque
// fraction jumped from 0.023 to 0.72 the moment the page dropped under 8% of
// the frame: an almost entirely black rectangle over his painting.
describe('a page too small in the frame to trim to', () => {
  const sweep = [0.5, 0.45, 0.4, 0.35, 0.32, 0.3, 0.29, 0.285, 0.28, 0.26, 0.24, 0.22, 0.2, 0.18, 0.15]

  it('crosses the threshold — the fixture really does exercise both sides', () => {
    const sides = sweep.map((fill) => autoTrimBounds(toGray(pageInFrame({ fill })), FRAME.w, FRAME.h).trusted)
    expect(sides).toContain(true)
    expect(sides).toContain(false)
    // and the guard is what does it: the paper area straddles 8% right there
    expect(paperArea(pageInFrame({ fill: 0.29 }))).toBeGreaterThan(TRIM_MIN_PAPER)
    expect(paperArea(pageInFrame({ fill: 0.285 }))).toBeLessThan(TRIM_MIN_PAPER)
  })

  it('has no cliff anywhere in the sweep', () => {
    let worst = 0
    let step = 0
    let prev = null
    for (const fill of sweep) {
      const opaque = opaqueFraction(processPage(pageInFrame({ fill })))
      worst = Math.max(worst, opaque)
      if (prev !== null) step = Math.max(step, Math.abs(opaque - prev))
      prev = opaque
    }
    expect(worst).toBeLessThan(0.12) // it was 0.72 and rising, right across the guard
    expect(step).toBeLessThan(0.1)
  })

  it('keys the untrimmed desk transparent instead of black', () => {
    const img = pageInFrame({ fill: 0.25 })
    const b = autoTrimBounds(toGray(img), FRAME.w, FRAME.h)
    expect(b).toMatchObject({ left: 0, top: 0, width: FRAME.w, height: FRAME.h, trusted: false, island: true })
    const out = processPage(img)
    expect(alphaAt(out, 10, 10)).toBe(0) // deep desk, far from the page
    expect(alphaAt(out, FRAME.w - 10, FRAME.h - 10)).toBe(0)
    expect(opaqueFraction(out)).toBeLessThan(0.05)
  })

  it('still keeps a dark drawing solid — that is artwork, not a desk', () => {
    // the same "barely any paper" frame, but the paper runs off the corner, so
    // the self-normalising fallback must NOT be used or the drawing vanishes
    const w = 120
    const h = 120
    const dark = make(w, h, (x, y) => (x > 90 && y > 90 ? [245, 245, 240] : [30, 28, 28]))
    const out = processPage(dark)
    expect(alphaAt(out, 20, 20)).toBe(255)
    expect(opaqueFraction(out)).toBeGreaterThan(0.5)
  })
})

// REGRESSION: raising TRIM_MAX from 15% to 35% raised the ceiling on how much
// real artwork the trim can eat. A solid band inked to the top of a full-bleed
// scan is not paper, so it falls outside the paper's bounding box: a 30% band
// was cropped away whole. The desk is what the big cap is for, and a desk
// SURROUNDS a page — so a side with paper running off both the others has no
// desk beside it and keeps the old conservative cap.
describe('a full-bleed page with a solid band inked to the top edge', () => {
  const w = 240
  const h = 320
  const cap = Math.floor(h * TRIM_SAFE)

  // REGRESSION: `safe` was a small cap rather than nothing, and a cap is a
  // ceiling on the CUT, not a floor on what survives — so a band THINNER than
  // the cap was still eaten whole. Measured: crop.top === bandPx exactly, 0
  // rows kept, for every band from 3% to 15%. Thick bands always left a
  // remainder and hid it, which is why only 20/30/40% were ever sampled here.
  it('keeps a band of any thickness, thin ones included', () => {
    for (const band of [0.03, 0.05, 0.08, 0.1, 0.15, 0.2, 0.3, 0.4]) {
      const b = autoTrimBounds(toGray(bleedPage({ w, h, band })), w, h)
      expect(b.top).toBeLessThanOrEqual(cap) // 160px of a 320px page was going
      expect(b.top).toBe(0) // and now nothing goes: there is no desk up there to cut
      expect(Math.round(h * band)).toBeGreaterThan(b.top) // the whole band survives
    }
  })

  it('keeps a band on the bottom edge just the same', () => {
    const upsideDown = (band) => {
      const bandH = Math.round(h * band)
      return make(w, h, (x, y) => {
        if (y >= h - bandH) return [18, 18, 18]
        const onLine = Math.abs(x - w * 0.5) < 2 || Math.abs(y - h * 0.3) < 2
        return onLine ? [24, 24, 22] : [246, 244, 240]
      })
    }
    for (const band of [0.05, 0.1, 0.3]) {
      expect(autoTrimBounds(toGray(upsideDown(band)), w, h).bottom).toBe(h - 1)
    }
  })

  it('keeps the paper edges it was never meant to touch', () => {
    const b = autoTrimBounds(toGray(bleedPage({ w, h, band: 0.3 })), w, h)
    expect(b.left).toBe(0)
    expect(b.right).toBe(w - 1)
    expect(b.bottom).toBe(h - 1)
    expect(b.island).toBe(false) // paper runs off the frame: no desk anywhere
  })

  it('keys the band it kept as solid ink, not as paper', () => {
    const out = processPage(bleedPage({ w, h, band: 0.3 }))
    expect(alphaAt(out, Math.round(w / 2), 3)).toBe(255)
    expect(alphaAt(out, 4, 3)).toBe(255)
    expect(alphaAt(out, 20, out.height - 20)).toBe(0) // paper below it, away from the strokes
  })

  it('still lets the big cap eat a real desk band on a photographed page', () => {
    // the conservative cap is only for a side with no desk beside it. Here the
    // desk is genuinely 22% down the top of the frame and has to go.
    const img = pageInFrame()
    const b = autoTrimBounds(toGray(img), FRAME.w, FRAME.h)
    expect(b.top).toBeGreaterThan(Math.floor(FRAME.h * TRIM_SAFE))
    expect(Math.abs(b.top - framePaper().top)).toBeLessThanOrEqual(2)
  })
})

describe('clearOffPaper', () => {
  const w = 10
  const h = 3
  // row 0: paper in the middle only; row 1: no paper at all; row 2: all paper
  const gray = new Uint8ClampedArray([
    30, 30, 30, 240, 240, 240, 240, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    240, 240, 240, 240, 240, 240, 240, 240, 240, 240,
  ])
  const rgba = new Uint8ClampedArray(w * h * 4).fill(255)
  clearOffPaper(rgba, gray, w, h, { pad: 0 })
  const a = (x, y) => rgba[(y * w + x) * 4 + 3]

  it('clears the desk beside the paper', () => {
    expect(a(0, 0)).toBe(0)
    expect(a(9, 0)).toBe(0)
    expect(a(4, 0)).toBe(255) // on the paper
  })

  it('leaves a row with no paper alone — that is ink, not desk', () => {
    expect(a(0, 1)).toBe(255)
    expect(a(5, 1)).toBe(255)
  })

  it('leaves a full row of paper alone', () => {
    expect(a(0, 2)).toBe(255)
  })
})

describe('adaptiveCuts', () => {
  it('reproduces the fixed pair on a black-ink page', () => {
    const w = 160
    const h = 160
    const art = make(w, h, (x, y) =>
      Math.abs(x - 80) < 1.5 || Math.abs(y - 80) < 1.5 ? [0, 0, 0] : [255, 255, 255],
    )
    const cuts = adaptiveCuts(flatField(toGray(art), w, h))
    expect(cuts.inkCut).toBeCloseTo(INK_CUT, 1)
    expect(cuts.paperCut).toBeGreaterThanOrEqual(PAPER_CUT)
  })

  it('leaves the ramp alone on a page with nothing on it', () => {
    const blank = make(64, 64, () => [246, 244, 240])
    expect(adaptiveCuts(flatField(toGray(blank), 64, 64)).inkCut).toBe(INK_CUT)
  })
})

describe('a page drawn in light pencil', () => {
  const w = 200
  const h = 200
  const img = make(w, h, (x, y) => {
    const onLine = Math.abs(x - w * 0.5) < 2 || Math.abs(y - h * 0.6) < 2
    return onLine ? [188, 186, 184] : [246, 244, 240] // faint graphite on white
  })
  const out = processPage(img)

  it('comes out dark enough to see', () => {
    // fixed cuts put this line at ~95/255, and the faint display mode then
    // multiplied it down to ~21 — a page that looked blank
    expect(alphaAt(out, Math.round(w * 0.5), 20)).toBeGreaterThan(200)
  })

  it('is still visible in the faint display mode', () => {
    expect(alphaAt(out, Math.round(w * 0.5), 20) * MODE_OPACITY.trace).toBeGreaterThan(40)
  })

  it('does not drag the paper along with it', () => {
    expect(alphaAt(out, 20, 20)).toBe(0)
    expect(opaqueFraction(out)).toBeLessThan(0.05)
  })
})

describe('family page discovery', () => {
  it('derives a Hebrew-friendly name and slug id from the filename', () => {
    expect(pageMetaFromPath('../../../coloring-pages/סבתא.png')).toMatchObject({ name: 'סבתא', vector: false })
    expect(pageMetaFromPath('../../../coloring-pages/the_dog.svg')).toMatchObject({ name: 'the dog', vector: true })
    // upper-case extension, and the id carries the extension so סבתא.png and
    // סבתא.jpg stay two different pages
    expect(pageMetaFromPath('../../../coloring-pages/Michael-2026.JPG').id).toBe('family-michael-2026-jpg')
  })

  it('maps and sorts a glob result', () => {
    const pages = pagesFromGlob({ '../../../coloring-pages/ב.png': '/b.png', '../../../coloring-pages/א.png': '/a.png' })
    expect(pages.map((p) => p.name)).toEqual(['א', 'ב'])
    expect(pages[0]).toMatchObject({ url: '/a.png', kind: 'image' })
  })

  it('handles an empty folder', () => {
    expect(pagesFromGlob({})).toEqual([])
    expect(pagesFromGlob(undefined)).toEqual([])
  })
})

describe('page display modes', () => {
  const mem = () => {
    const store = new Map()
    return { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
  }

  it('remembers a per-page choice', () => {
    const s = mem()
    const next = savePageMode({}, 'family-סבתא', 'trace', s)
    expect(next['family-סבתא']).toBe('trace')
    expect(loadPageModes(s)).toEqual(next)
  })

  it('survives unusable storage', () => {
    const broken = { getItem: () => { throw new Error('nope') }, setItem: () => { throw new Error('nope') } }
    expect(loadPageModes(broken)).toEqual({})
    expect(savePageMode({}, 'x', 'lines', broken)).toEqual({ x: 'lines' })
  })

  it('trace is faint, lines are solid', () => {
    expect(MODE_OPACITY.lines).toBe(1)
    expect(MODE_OPACITY.trace).toBeLessThan(0.4)
  })
})
