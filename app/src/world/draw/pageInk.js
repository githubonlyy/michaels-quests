// Turning a family picture into a coloring overlay.
//
// The template layer sits ABOVE the drawing canvas so the black lines stay crisp
// while he colors underneath. A raw picture used that way would cover his work
// with an opaque rectangle, so every raster page goes through here first:
//
//   auto-trim   -> drop the table/desk visible past the edge of a photographed page
//   flat-field  -> kill the lighting gradient and normalise cream paper to white
//   key-to-alpha-> paper becomes transparent, ink becomes solid black
//
// Order matters: trimming runs on the ORIGINAL luminance, because flat-fielding
// divides by a local background and would normalise the dark table to white
// right along with the paper. Cropping first also keeps the desk out of the
// blur that estimates the lighting.
//
// Four steps here are easy to get wrong and were all wrong once:
//
//   * The background must be estimated from PAPER ONLY. A plain blur of the
//     whole picture is dark in the middle of a filled shape (black hair, a thick
//     frame, a solid title bar), so that shape divides itself back to white and
//     keys to transparent — a filled area comes out as a ring with a hole in it.
//     backgroundField() therefore averages only the pixels that look like paper,
//     and widens its window where there are none.
//
//   * Trimming must find the paper's bounding box, not walk inwards line by
//     line. Nobody photographs a page edge to edge — it lands in the middle of
//     the frame with desk all round — and a line-by-line walk stops at the first
//     row that looks "mostly page", which on a slightly tilted photo is the row
//     that clips one corner. autoTrimBounds() measures the longest run of paper
//     on every row and column instead, and TRIM_MAX is only a safety net.
//
//   * Not everything dark outside the paper is a desk. A solid band inked to
//     the edge of a full-bleed page is not paper either, and a frame that turns
//     out to be nearly all desk is not a page at all. Both are decided the same
//     way, and it is the only reliable way: a DESK SURROUNDS A PAGE. Paper that
//     runs off the edge of the picture has no table beside it, so the dark strip
//     there is artwork and is left alone entirely (TRIM_SAFE); paper with frame
//     all round it (paperIsIsland) is a page on a table even when there is too
//     little of it to crop to, and the desk is keyed away with the plain
//     self-normalising blur instead of the paper-only field.
//
//   * The table is not always darker than the page, and none of the above works
//     if the wrong population is called "paper" in the first place. On a pale
//     wooden table the table is most of the frame and lands in one histogram
//     bin, while the shaded page is spread over forty — so the TALLEST peak is
//     furniture, and every threshold here was then measured against it: nothing
//     was ever cropped, and the table's own grain keyed as solid ink. paperLevel
//     takes the brightest peak with real area, paperCutoff drops the paper/desk
//     line into the valley between the two when a light table makes one, and the
//     trim votes over a neighbourhood (TRIM_SMOOTH) so single grains of a
//     textured table cannot pass for page.
//
// Everything here is pure math over {data, width, height} buffers (ImageData
// shaped) so it can be unit-tested without a DOM.

export const BLUR_DIVISOR = 16 // background window radius = min(w,h) / this
export const PAPER_PEAK_SPREAD = 4 // histogram bins each side of a peak, so lighting-smeared paper is weighed against a flat desk fairly
export const PAPER_MIN_MASS = 0.005 // ...and a peak has to cover this much of the frame before it can be the paper
export const PAPER_VALLEY_RISE = 4 // a gap between two bright peaks counts as a valley once the lower one is this many times as full
export const PAPER_CUT = 0.86 // corrected luminance at/above this is paper
export const INK_CUT = 0.62 // at/below this is solid ink
export const TRIM_MAX = 0.35 // safety net: never trim more than this off a side
export const TRIM_SAFE = 0 // ...and nothing at all off a side that shows no desk: what is there is artwork
export const TRIM_BLEED = 0.01 // paper within this much of a frame edge is running off it
export const TRIM_PAPER_RATIO = 0.6 // a line is "page" once its paper run is this much of the widest one
export const TRIM_PAPER_FRAC = 0.72 // ...and a pixel counts as paper at this fraction of the paper level
export const TRIM_SMOOTH = 0.01 // the page/desk vote is taken over a neighbourhood this wide (fraction of min(w,h))
export const TRIM_GAP = 0.012 // a paper run survives a stroke this wide crossing it (fraction of min(w,h))
export const EDGE_PAD = 2 // pixels of slack kept beside the paper, for ink drawn to the very edge
export const TRIM_MIN_PAPER = 0.08 // below this much paper in the frame there is no page to trim to
export const TRIM_EDGE_BAND = 0.04 // border ring of the frame searched for paper
export const TRIM_ISLAND_MAX = 0.05 // at most this much of the paper may sit in that ring to be an island

export const BG_PAPER_FRAC = 0.78 // a pixel joins the background estimate at this fraction of the paper level
export const BG_MIN_SUPPORT = 0.04 // ...and a window needs this much paper in it before its average is trusted
export const BG_WIDE_FACTOR = 4 // second, wider window for the middle of filled shapes
export const BG_GRID = 8 // the background is estimated on a grid of this many cells per blur radius

export const ADAPT_MIN_INK = 0.0008 // adapt the cuts only once this fraction of the page is ink
export const ADAPT_PAPER_MAX = 0.95 // however tight the paper peak is, keep this much headroom
export const ADAPT_PAPER_MARGIN = 0.04 // ...and stay at least this far below the paper level itself
export const ADAPT_FOOT_FRAC = 0.02 // the paper peak ends where it has fallen to this fraction of its height
export const INK_SOLID_AT = 0.35 // ink is fully solid this far from paper towards the page's darkest ink
// INK_SOLID_AT is exactly what the fixed pair above already says for a black-ink
// page: 0.86 - 0.86 * 0.35 = 0.62. On a pencil page it rides up with the page.

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v)
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

/** Rec. 601 luma, one byte per pixel. */
export function toGray({ data, width, height }) {
  const out = new Uint8ClampedArray(width * height)
  for (let i = 0, p = 0; p < out.length; i += 4, p++) {
    out[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
  }
  return out
}

/**
 * Separable box blur over a single-channel buffer. Two passes approximate a
 * Gaussian well enough for background estimation and stay O(n) via a running sum.
 */
export function boxBlurGray(src, width, height, radius) {
  if (radius < 1) return Uint8ClampedArray.from(src)
  const tmp = new Uint8ClampedArray(src.length)
  const out = new Uint8ClampedArray(src.length)
  const span = radius * 2 + 1

  for (let y = 0; y < height; y++) {
    const row = y * width
    let sum = src[row] * (radius + 1)
    for (let x = 1; x <= radius; x++) sum += src[row + Math.min(x, width - 1)]
    for (let x = 0; x < width; x++) {
      tmp[row + x] = sum / span
      sum += src[row + Math.min(x + radius + 1, width - 1)] - src[row + Math.max(x - radius, 0)]
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = tmp[x] * (radius + 1)
    for (let y = 1; y <= radius; y++) sum += tmp[Math.min(y, height - 1) * width + x]
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / span
      sum += tmp[Math.min(y + radius + 1, height - 1) * width + x] - tmp[Math.max(y - radius, 0) * width + x]
    }
  }
  return out
}

/**
 * The same running-sum box blur without the 0..255 rounding. The background
 * estimator averages a 0/1 mask as well as luminance, so it cannot go through a
 * Uint8 buffer: a mask blur rounds to 0 or 1 and every fraction is lost.
 */
export function boxBlurF32(src, width, height, radius) {
  if (radius < 1) return Float32Array.from(src)
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  const span = radius * 2 + 1

  for (let y = 0; y < height; y++) {
    const row = y * width
    let sum = src[row] * (radius + 1)
    for (let x = 1; x <= radius; x++) sum += src[row + Math.min(x, width - 1)]
    for (let x = 0; x < width; x++) {
      tmp[row + x] = sum / span
      sum += src[row + Math.min(x + radius + 1, width - 1)] - src[row + Math.max(x - radius, 0)]
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = tmp[x] * (radius + 1)
    for (let y = 1; y <= radius; y++) sum += tmp[Math.min(y, height - 1) * width + x]
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / span
      sum += tmp[Math.min(y + radius + 1, height - 1) * width + x] - tmp[Math.max(y - radius, 0) * width + x]
    }
  }
  return out
}

/**
 * A luminance histogram plus its windowed mass — mass[v] counts everything
 * within PAPER_PEAK_SPREAD bins of v. Every decision about "which population is
 * this" needs the second one: a peak that lighting has smeared over forty bins
 * and a flat table that lands in one are not comparable bin against bin.
 */
function histMass(gray) {
  const hist = new Uint32Array(256)
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++

  const mass = new Float64Array(256)
  let sum = 0
  for (let v = 0; v <= PAPER_PEAK_SPREAD; v++) sum += hist[v]
  for (let v = 0; v < 256; v++) {
    mass[v] = sum
    const add = v + PAPER_PEAK_SPREAD + 1
    const drop = v - PAPER_PEAK_SPREAD
    if (add < 256) sum += hist[add]
    if (drop >= 0) sum -= hist[drop]
  }
  return { hist, mass }
}

/**
 * How bright the PAPER is: the brightest peak of the histogram that covers a
 * real part of the picture.
 *
 * Brightest, not tallest. A page photographed on a light wooden table is a
 * minority of the frame and its brightness is smeared across dozens of bins by
 * the lighting, while the flat table lands in one or two — so the TALLEST peak
 * is the table, and every threshold downstream is then measured against
 * furniture: the trim finds "paper" everywhere and crops nothing at all, and a
 * table with any grain in it keys as solid ink over his painting. That was
 * measured at a quarter of the sheet gone black on a mid-grey desk. The table
 * is never the brightest thing in a photograph of a page lying on it, so
 * brightest-with-support has no such failure.
 *
 * Support is counted over a small window, so a peak that lighting has spread
 * over forty bins is compared fairly with one that sits in a single bin. The
 * value returned is the real histogram bin under the peak, not the edge of that
 * window.
 */
export function paperLevel(gray) {
  const { hist, mass } = histMass(gray)

  // Down from white to the first window carrying real area — anything smaller
  // is a specular highlight or sensor noise, not the page — and then on down
  // while the window is still filling up, which lands on the top of that peak.
  // The walk always terminates on a peak: the average window already holds
  // 2*SPREAD+1 of 256 bins, which is more than PAPER_MIN_MASS.
  const need = gray.length * PAPER_MIN_MASS
  let v = 255
  while (v > 0 && mass[v] < need) v--
  while (v > 0 && mass[v - 1] > mass[v]) v--

  // the real bin under that peak, not the edge of the window
  let best = v
  let bestCount = 0
  for (let u = Math.min(255, v + PAPER_PEAK_SPREAD); u >= Math.max(0, v - PAPER_PEAK_SPREAD); u--) {
    if (hist[u] > bestCount) {
      bestCount = hist[u]
      best = u
    }
  }
  return best
}

/**
 * How bright the PAPER is around every pixel — the lighting, with the ink taken
 * out of the average.
 *
 * A plain blur answers "how bright is it here", which in the middle of a filled
 * black shape is "black"; the flat-field then divides black by black and keys
 * the inside of the shape to transparent, leaving a ring with a hole in it. So
 * only paper-looking pixels are averaged, as a normalised box blur: blurred
 * paper luminance over blurred paper mask.
 *
 * Deep inside a filled shape no paper is in reach at all, so the window widens
 * once (BG_WIDE_FACTOR) and finally falls back to the page's own paper level.
 * The wide pass — most of the cost — is skipped unless some pixel needs it,
 * which on ordinary line art is never.
 */
export function backgroundField(gray, width, height, divisor = BLUR_DIVISOR, paper = paperLevel(gray)) {
  const radius = Math.max(1, Math.floor(Math.min(width, height) / divisor))
  const cut = paper * BG_PAPER_FRAC

  // The field is smooth over a whole blur radius, so it is estimated on a coarse
  // grid — BG_GRID cells per radius — and interpolated back. On a 1400px page
  // that is a 175x175 grid instead of 1.96M pixels, which is what keeps four
  // blurs affordable on a tablet.
  const step = Math.max(1, Math.floor(radius / BG_GRID))
  const sw = Math.ceil(width / step)
  const sh = Math.ceil(height / step)
  const lit = new Float32Array(sw * sh) // paper luminance summed per cell
  const seen = new Float32Array(sw * sh) // ...over this many paper pixels
  for (let y = 0; y < height; y++) {
    const row = y * width
    const cell = ((y / step) | 0) * sw
    for (let x = 0; x < width; x++) {
      const v = gray[row + x]
      if (v >= cut) {
        const c = cell + ((x / step) | 0)
        lit[c] += v
        seen[c] += 1
      }
    }
  }

  const r = Math.max(1, Math.round(radius / step))
  const den = boxBlurF32(seen, sw, sh, r)
  const num = boxBlurF32(lit, sw, sh, r)
  const support = BG_MIN_SUPPORT * step * step // den counts pixels, not cells
  let starved = false
  for (let i = 0; i < den.length; i++) {
    if (den[i] < support) {
      starved = true
      break
    }
  }
  const wide = Math.min(Math.max(sw, sh), r * BG_WIDE_FACTOR)
  const denWide = starved ? boxBlurF32(seen, sw, sh, wide) : null
  const numWide = starved ? boxBlurF32(lit, sw, sh, wide) : null

  const small = new Float32Array(sw * sh)
  for (let i = 0; i < small.length; i++) {
    if (den[i] >= support) small[i] = num[i] / den[i]
    else if (starved && denWide[i] >= support) small[i] = numWide[i] / denWide[i]
    else small[i] = paper // no paper within reach: assume the page's own level
  }
  return step === 1 ? small : upsample(small, sw, sh, width, height, step)
}

/** Bilinear blow-up of the coarse background grid back to full size. */
function upsample(small, sw, sh, width, height, step) {
  const out = new Float32Array(width * height)
  const lo = (i, n) => (i < 0 ? 0 : i > n - 1 ? n - 1 : i)
  for (let y = 0; y < height; y++) {
    const fy = y / step - 0.5
    const j = Math.floor(fy)
    const ty = fy - j
    const r0 = lo(j, sh) * sw
    const r1 = lo(j + 1, sh) * sw
    const o = y * width
    for (let x = 0; x < width; x++) {
      const fx = x / step - 0.5
      const i = Math.floor(fx)
      const tx = fx - i
      const i0 = lo(i, sw)
      const i1 = lo(i + 1, sw)
      const a = small[r0 + i0] + (small[r0 + i1] - small[r0 + i0]) * tx
      const b = small[r1 + i0] + (small[r1 + i1] - small[r1 + i0]) * tx
      out[o + x] = a + (b - a) * ty
    }
  }
  return out
}

/**
 * The plain blur the background estimate used to be: "how bright is it here",
 * ink and all. It is wrong in the middle of a filled shape — see above — but it
 * has one property the paper-only field cannot have: it is SELF-NORMALISING.
 * Anything wide compared to the window divides by itself and goes to white,
 * whatever its brightness, so a desk keys transparent without being recognised
 * as a desk first. That is exactly what is wanted when the frame turns out not
 * to hold a page we could crop to (see processPage).
 */
export function blurBackground(gray, width, height, divisor = BLUR_DIVISOR) {
  const radius = Math.max(1, Math.floor(Math.min(width, height) / divisor))
  const blurred = boxBlurGray(gray, width, height, radius)
  const out = new Float32Array(gray.length)
  for (let i = 0; i < out.length; i++) out[i] = blurred[i]
  return out
}

/**
 * Divide the image by the background above. The window is far larger than a pen
 * stroke, so lines survive while a lighting gradient and the paper's own tint
 * are flattened to uniform white. Returns 0..1 per pixel.
 *
 * `paperOnly: false` swaps in the self-normalising plain blur, for a frame with
 * no trustworthy page in it.
 */
export function flatField(gray, width, height, divisor = BLUR_DIVISOR, { paperOnly = true } = {}) {
  const bg = paperOnly
    ? backgroundField(gray, width, height, divisor)
    : blurBackground(gray, width, height, divisor)
  const out = new Float32Array(gray.length)
  for (let i = 0; i < gray.length; i++) {
    const b = bg[i]
    out[i] = b <= 1 ? 1 : Math.min(1, gray[i] / b)
  }
  return out
}

/**
 * Longest run of paper on each line, allowing `gap` non-paper pixels inside a
 * run so a stroke crossing the page does not split the page in two. Lines are
 * walked by index arithmetic — `stride` steps along a line, `pitch` steps to the
 * next one — so the same scan serves rows (1, width) and columns (width, 1).
 * Returns three parallel arrays: run length, run start, run end per line.
 */
function paperRuns(gray, lines, length, stride, pitch, cut, gap) {
  const len = new Int32Array(lines)
  const from = new Int32Array(lines).fill(-1)
  const to = new Int32Array(lines).fill(-1)
  for (let i = 0; i < lines; i++) {
    const base = i * pitch
    let start = -1
    let last = -1
    for (let k = 0; k < length; k++) {
      if (gray[base + k * stride] >= cut) {
        if (start < 0) start = k
        last = k
      } else if (start >= 0 && k - last > gap) {
        if (last - start + 1 > len[i]) {
          len[i] = last - start + 1
          from[i] = start
          to[i] = last
        }
        start = -1
      }
    }
    if (start >= 0 && last - start + 1 > len[i]) {
      len[i] = last - start + 1
      from[i] = start
      to[i] = last
    }
  }
  return { len, from, to }
}

/**
 * Is the paper an ISLAND — a bright patch with frame all round it, rather than a
 * page running off the edge of the picture?
 *
 * This is the one thing that tells a desk from a drawing. A desk SURROUNDS the
 * paper: the border of the frame is all table. A dark drawing does not — its
 * paper reaches the edge of the picture like any other page, and the dark parts
 * are somebody's artwork, not furniture. Both look identical pixel for pixel in
 * the middle of the frame, so the border is where the answer is.
 *
 * Measured as a fraction of the PAPER, not of the border, so a highlight on the
 * table or a bright speck of noise at the edge cannot flip the answer.
 */
export function paperIsIsland(gray, width, height, cut, { band = TRIM_EDGE_BAND, most = TRIM_ISLAND_MAX } = {}) {
  const t = Math.max(1, Math.round(Math.min(width, height) * band))
  let total = 0
  let onEdge = 0
  for (let y = 0; y < height; y++) {
    const edgeRow = y < t || y >= height - t
    const row = y * width
    for (let x = 0; x < width; x++) {
      if (gray[row + x] < cut) continue
      total++
      if (edgeRow || x < t || x >= width - t) onEdge++
    }
  }
  return total > 0 && onEdge <= total * most
}

/**
 * The luminance below which a pixel is not this page's paper.
 *
 * Normally a plain fraction of the paper level: paper is never more than about
 * a quarter darker than its brightest corner, and anything under that is ink or
 * furniture. That fails against a table nearly as light as the paper — a pale
 * wooden desk at 170 against paper at 217 sits ABOVE 72% of 217, so the whole
 * frame reads as page, nothing is cropped, and the table's own grain then keys
 * as ink. The two populations are perfectly obvious in the histogram, though:
 * two bright humps with an empty valley between them. So when there is a
 * valley, the cut goes in it.
 *
 * Only when it is a TABLE, mind. A pale wash, a light pencil fill or a grey sky
 * in the drawing makes exactly the same second hump, and cutting above that
 * would crop the drawing. The test is the one this whole module turns on: a
 * desk SURROUNDS a page. If cutting at the valley leaves paper that has frame
 * all round it, the hump underneath was the table; if the paper still runs to
 * the edges of the picture, the hump was part of the picture and the plain cut
 * stands.
 */
export function paperCutoff(gray, width, height, paper = paperLevel(gray)) {
  const base = paper * TRIM_PAPER_FRAC
  const lowest = Math.max(0, Math.ceil(base))
  const top = Math.min(255, Math.round(paper))
  if (lowest >= top) return base

  const { mass } = histMass(gray)
  let valley = top
  let empty = Infinity
  for (let v = top - 1; v >= lowest; v--) {
    if (mass[v] < empty) {
      empty = mass[v]
      valley = v
    }
  }
  if (valley <= lowest) return base

  // ...and it is only a valley if something fills up again underneath it
  let below = 0
  for (let v = valley - 1; v >= lowest; v--) if (mass[v] > below) below = mass[v]
  if (below < Math.max(empty * PAPER_VALLEY_RISE, gray.length * PAPER_MIN_MASS)) return base

  return paperIsIsland(gray, width, height, valley) ? valley : base
}

/**
 * The paper's bounding box — the desk around a photographed page is everything
 * outside it. Every row and every column is measured for its longest paper run;
 * the lines carrying a run close to the widest one ARE the page, and the box is
 * the union of where those runs start and end. Rows and columns are both used
 * because a tilted page's corner is short on one axis and long on the other.
 *
 * `max` is a safety net for a picture with no recognisable paper in it, not the
 * normal stopping point: a page usually fills only the middle of a phone photo,
 * so 15% a side was never enough — and 35% is not a target either, it is the
 * point past which we would rather keep some desk than eat somebody's drawing.
 *
 * That bigger net needs a second latch, because it only ever eats what lies
 * outside the paper and not all of that is desk. A solid title band inked to the
 * top of a full-bleed scan is not "paper" either, so it falls outside the box
 * and 35% of it can be cut away. The two are told apart by where the desk is:
 * a desk SURROUNDS a page, so if the paper already runs off the left and right
 * of the frame there is no table beside it and a dark strip along the top is
 * artwork. Such a side is cut by `safe`, which is nothing at all.
 *
 * Returns the box plus two flags for the caller: `trusted` — a page really was
 * located — and `island` — the paper has frame all round it.
 */
export function autoTrimBounds(
  gray,
  width,
  height,
  { paperMin, max = TRIM_MAX, safe = TRIM_SAFE, ratio = TRIM_PAPER_RATIO, gap } = {},
) {
  const cut = paperMin ?? paperCutoff(gray, width, height)
  const slack = gap ?? Math.round(Math.min(width, height) * TRIM_GAP)
  const full = (rest) => ({ left: 0, top: 0, right: width - 1, bottom: height - 1, width, height, ...rest })

  // The question this function asks is WHERE THE PAGE IS, and a page is one
  // large solid region. Table grain, sensor noise and JPEG blocking are none of
  // that, and on a light table they straddle `cut`: single specks read as paper,
  // the gap-bridging in paperRuns() strings them into long runs, and the box
  // grows back out over the desk it exists to remove. Measured on a mid-grey
  // wooden table with visible grain: a quarter of the sheet came out solid black
  // over his painting.
  //
  // So a pixel counts as page only if its NEIGHBOURHOOD does — a majority vote
  // over a few pixels, not a threshold on one. Speckle at any density under half
  // loses the vote and disappears; the page keeps every interior pixel; and a
  // page EDGE does not move, because half of the window is on each side of it,
  // which is what a plain blur of the luminance gets wrong (it drags the
  // boundary towards whichever side is further from `cut`, and against a light
  // table that is several pixels of table pulled inside the crop, i.e. a black
  // outline around every page). Blurring the 0/1 mask instead of the greys is
  // the whole trick. A pen line is thin against this window and keeps its
  // majority, so it does not punch holes in the page either.
  const near = Math.max(1, Math.round(Math.min(width, height) * TRIM_SMOOTH))
  const solid = new Uint8ClampedArray(gray.length)
  for (let i = 0; i < gray.length; i++) solid[i] = gray[i] >= cut ? 255 : 0
  const mask = boxBlurGray(solid, width, height, near)
  const vote = 128 // "most of the neighbourhood is page"

  // With this little paper in the frame there is no photographed page to find —
  // it is a drawing that happens to be dark, and `max` could only chew 35% off
  // each side of it. Keep the picture whole instead, and tell the caller the
  // trim did not fire so it can pick a background estimate that survives that.
  let paperPixels = 0
  for (let i = 0; i < mask.length; i++) if (mask[i] >= vote) paperPixels++
  if (paperPixels < mask.length * TRIM_MIN_PAPER) {
    return full({ trusted: false, island: paperIsIsland(mask, width, height, vote) })
  }

  const rows = paperRuns(mask, height, width, 1, width, vote, slack)
  const cols = paperRuns(mask, width, height, width, 1, vote, slack)
  let widest = 0
  for (let i = 0; i < height; i++) if (rows.len[i] > widest) widest = rows.len[i]
  for (let i = 0; i < width; i++) if (cols.len[i] > widest) widest = cols.len[i]
  // nothing that looks like paper: keep the picture whole
  if (widest < 2) return full({ trusted: false, island: false })

  const need = Math.max(2, widest * ratio)
  let left = width
  let right = -1
  let top = height
  let bottom = -1
  for (let y = 0; y < height; y++) {
    if (rows.len[y] < need) continue
    if (y < top) top = y
    if (y > bottom) bottom = y
    if (rows.from[y] < left) left = rows.from[y]
    if (rows.to[y] > right) right = rows.to[y]
  }
  for (let x = 0; x < width; x++) {
    if (cols.len[x] < need) continue
    if (x < left) left = x
    if (x > right) right = x
    if (cols.from[x] < top) top = cols.from[x]
    if (cols.to[x] > bottom) bottom = cols.to[x]
  }
  if (right < left || bottom < top) return full({ trusted: false, island: false })

  // Safety net, in case what we locked onto was a bright patch of desk — or was
  // never desk at all. Paper touching a frame edge is paper running OFF it, so
  // that edge shows no table; a side with no table beside it can only be eating
  // artwork, and is left alone entirely.
  //
  // `safe` used to be a small cap here rather than nothing, and that is not the
  // same thing: a cap is a ceiling on the CUT, not a floor on what survives, so
  // every full-width band thinner than the cap was still eaten whole — a 10%
  // title bar came out at exactly 0 rows kept, silently, on every full-bleed
  // scan. Half a band is no better than all of it. There is no measurement that
  // tells a solid band of ink from a strip of table; what tells them apart is
  // the table being ABSENT from the other two sides, and that is already known
  // here. So: desk beside this side, cut up to `max`; no desk beside it, cut
  // `safe` — which is nothing at all.
  const bleedX = Math.max(1, Math.round(width * TRIM_BLEED))
  const bleedY = Math.max(1, Math.round(height * TRIM_BLEED))
  const runsOffSides = left <= bleedX && right >= width - 1 - bleedX
  const runsOffEnds = top <= bleedY && bottom >= height - 1 - bleedY
  const maxX = Math.floor(width * (runsOffEnds ? safe : max))
  const maxY = Math.floor(height * (runsOffSides ? safe : max))
  left = Math.min(left, maxX)
  top = Math.min(top, maxY)
  right = Math.max(right, width - 1 - maxX)
  bottom = Math.max(bottom, height - 1 - maxY)
  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
    trusted: true,
    island: !runsOffSides && !runsOffEnds,
  }
}

/**
 * Clear whatever is beside the paper on each row, in place.
 *
 * A tilted photo still has a triangle of desk in each corner of the paper's
 * bounding box, and keying turns those into solid black wedges. On any row that
 * HAS paper, everything outside the outermost paper pixels is desk, not page.
 * A row with no paper at all is left alone: on a page with a filled band right
 * across it, that row is ink, and nothing here can tell it from a desk.
 *
 * The extent is the first-to-last paper pixel rather than a run, so a shadow or
 * a fold across the page cannot cut the row in half, and it is padded by a
 * couple of pixels so a stroke inked right up to the edge of the paper survives.
 * The pad stays small on purpose: every padded pixel along a tilted edge is desk
 * that stays black.
 */
export function clearOffPaper(rgba, gray, width, height, { paperMin, pad = EDGE_PAD } = {}) {
  const cut = paperMin ?? paperCutoff(gray, width, height)
  for (let y = 0; y < height; y++) {
    const row = y * width
    let first = -1
    let last = -1
    for (let x = 0; x < width; x++) {
      if (gray[row + x] >= cut) {
        if (first < 0) first = x
        last = x
      }
    }
    if (first < 0) continue
    const lo = Math.max(0, first - pad)
    const hi = Math.min(width - 1, last + pad)
    for (let x = 0; x < lo; x++) rgba[(row + x) * 4 + 3] = 0
    for (let x = hi + 1; x < width; x++) rgba[(row + x) * 4 + 3] = 0
  }
  return rgba
}

/** copy a rectangle out of a single-channel buffer */
export function cropGray(gray, width, b) {
  const out = new Uint8ClampedArray(b.width * b.height)
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) out[y * b.width + x] = gray[(y + b.top) * width + (x + b.left)]
  }
  return out
}

/**
 * Where to put the paper/ink cuts for THIS page, read off its own histogram of
 * corrected luminance.
 *
 * Fixed cuts are tuned for a black pen on white paper. A page drawn in light
 * pencil never reaches them: it lands mid-ramp at about a third of full alpha,
 * and the faint display mode then multiplies that down to nothing. So the paper
 * cut goes just under the foot of the paper peak, and the ink cut a fixed part
 * of the way from there down to the darkest ink the page actually contains —
 * which on a black-ink page reproduces the fixed pair almost exactly, and on a
 * pencil page rides up with it. A page with no real ink keeps the defaults.
 */
export function adaptiveCuts(flat) {
  const total = flat.length
  const hist = new Uint32Array(256)
  for (let i = 0; i < total; i++) hist[clamp255(Math.round(flat[i] * 255))]++

  let mode = 255
  let peak = 0
  for (let v = 255; v >= 128; v--) {
    if (hist[v] > peak) {
      peak = hist[v]
      mode = v
    }
  }
  if (peak < total * 0.2) return { paperCut: PAPER_CUT, inkCut: INK_CUT } // no paper peak worth trusting

  let foot = mode
  while (foot > 1 && hist[foot - 1] > peak * ADAPT_FOOT_FRAC) foot--
  const paperCut = clamp(Math.min(foot / 255 - 0.01, mode / 255 - ADAPT_PAPER_MARGIN), PAPER_CUT, ADAPT_PAPER_MAX)

  const inkTop = Math.floor(paperCut * 255)
  let inkCount = 0
  for (let v = 0; v < inkTop; v++) inkCount += hist[v]
  if (inkCount < total * ADAPT_MIN_INK) return { paperCut, inkCut: INK_CUT } // blank-ish page: leave the ramp alone

  const need = Math.max(1, Math.floor(inkCount * 0.02)) // ignore a few stray dark specks
  let seen = 0
  let darkest = inkTop
  for (let v = 0; v < inkTop; v++) {
    seen += hist[v]
    if (seen >= need) {
      darkest = v
      break
    }
  }
  const inkCut = clamp(paperCut - (paperCut - darkest / 255) * INK_SOLID_AT, 0.3, paperCut - 0.04)
  return { paperCut, inkCut }
}

/**
 * Paper -> transparent, ink -> opaque black, with a soft ramp between so a
 * light pencil line still reads. Colour is forced to black: the source may be a
 * blue-ish photo of a black pen and we want line art, not tint.
 */
export function keyToAlpha(flat, width, height, { paperCut = PAPER_CUT, inkCut = INK_CUT } = {}) {
  const out = new Uint8ClampedArray(width * height * 4)
  const span = Math.max(1e-6, paperCut - inkCut)
  for (let i = 0; i < flat.length; i++) {
    const v = flat[i]
    const a = v >= paperCut ? 0 : v <= inkCut ? 255 : Math.round(((paperCut - v) / span) * 255)
    const o = i * 4
    out[o] = 0
    out[o + 1] = 0
    out[o + 2] = 0
    out[o + 3] = a
  }
  return { data: out, width, height }
}

/**
 * Full pipeline. `image` is ImageData-shaped; returns ImageData-shaped RGBA with
 * transparent paper, plus the bounds that were kept. Pass `adapt: false`, or a
 * paperCut/inkCut of your own, to key with fixed cuts instead.
 */
export function processPage(image, opts = {}) {
  const gray = toGray(image)
  const full = { left: 0, top: 0, right: image.width - 1, bottom: image.height - 1, width: image.width, height: image.height, trusted: true, island: false }
  const bounds = opts.trim === false ? full : autoTrimBounds(gray, image.width, image.height, opts)
  const cropped = bounds.width === image.width && bounds.height === image.height
    ? gray
    : cropGray(gray, image.width, bounds)

  // Which background estimate this frame can stand. Normally the paper-only one:
  // it is the only one that keeps the inside of a filled shape black. But when
  // the trim found no page to crop to AND the paper is an island, the frame is
  // mostly desk, and a paper-only field hands that desk the PAGE's paper level —
  // the desk then divides to about 0.16 and keys as solid ink, a black sheet
  // over his painting. The plain blur has no such failure: the desk divides by
  // itself and disappears. A dark drawing whose paper runs off the frame edge is
  // not an island and keeps the paper-only field, so its ink stays solid.
  const paperOnly = opts.paperOnly ?? (bounds.trusted !== false || !bounds.island)
  const flat = flatField(cropped, bounds.width, bounds.height, opts.divisor, { paperOnly })
  const cuts = opts.adapt === false ? {} : adaptiveCuts(flat)
  const out = keyToAlpha(flat, bounds.width, bounds.height, { ...cuts, ...opts })
  if (opts.trim !== false) clearOffPaper(out.data, cropped, bounds.width, bounds.height, opts)
  return { ...out, bounds }
}

export { clamp255 }
