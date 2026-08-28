// Coloring-page outlines. Each template is a list of SVG path `d` strings in a
// 400x400 box, drawn as thick black strokes with no fill so he colors inside.
// Pure data (no DOM) so the catalog can be validated by unit tests.

export const TEMPLATE_VIEW = 400
export const TEMPLATE_STROKE = 8

const rad = (deg) => (deg * Math.PI) / 180
const f = (n) => Math.round(n * 10) / 10

/** ellipse as two arcs; `rot` in degrees */
export function ellipsePath(cx, cy, rx, ry, rot = 0) {
  const c = Math.cos(rad(rot))
  const s = Math.sin(rad(rot))
  const x1 = f(cx + rx * c)
  const y1 = f(cy + rx * s)
  const x2 = f(cx - rx * c)
  const y2 = f(cy - rx * s)
  return `M${x1} ${y1} A${rx} ${ry} ${rot} 1 0 ${x2} ${y2} A${rx} ${ry} ${rot} 1 0 ${x1} ${y1} Z`
}
export const circlePath = (cx, cy, r) => ellipsePath(cx, cy, r, r)

/** puffy cloud with a flat base, centred on (cx, cy), scaled by `s` */
export function cloudPath(cx, cy, s = 1) {
  const p = (x, y) => `${f(cx + x * s)} ${f(cy + y * s)}`
  const r = (n) => f(n * s)
  return [
    `M${p(-62, 22)} L${p(62, 22)}`,
    `A${r(24)} ${r(24)} 0 0 0 ${p(58, -14)}`,
    `A${r(32)} ${r(32)} 0 0 0 ${p(8, -40)}`,
    `A${r(34)} ${r(34)} 0 0 0 ${p(-46, -22)}`,
    `A${r(28)} ${r(28)} 0 0 0 ${p(-62, 22)} Z`,
  ].join(' ')
}

const mirrorX = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${f(TEMPLATE_VIEW - Number(x))} ${y}`)

// --- individual pages -------------------------------------------------------

const heart = [
  'M200 345 C130 290 40 230 40 145 C40 95 80 58 125 58 C162 58 188 80 200 108 C212 80 238 58 275 58 C320 58 360 95 360 145 C360 230 270 290 200 345 Z',
]

const star = [
  'M200 50 L236.4 149.8 L342.7 153.6 L258.9 219.2 L288.2 321.4 L200 262 L111.8 321.4 L141 219.2 L57.3 153.6 L163.6 149.8 Z',
  circlePath(88, 92, 15),
  circlePath(318, 300, 12),
  circlePath(320, 92, 9),
]

const rocket = (() => {
  const finL = 'M140 195 L92 268 L140 250 Z'
  return [
    'M200 38 C242 90 262 152 262 222 L138 222 C138 152 158 90 200 38 Z',
    finL,
    mirrorX(finL),
    'M138 222 L138 268 L262 268 L262 222',
    circlePath(200, 142, 34),
    circlePath(200, 142, 19),
    'M166 270 C176 316 190 344 200 372 C210 344 224 316 234 270',
    'M186 288 C192 316 196 332 200 350',
  ]
})()

const dino = [
  circlePath(96, 148, 46),
  circlePath(80, 134, 7),
  'M52 166 L118 166',
  'M118 178 L164 214',
  ellipsePath(216, 238, 92, 64),
  'M300 226 C348 208 372 176 380 140',
  'M156 186 L168 156 L184 186',
  'M196 172 L210 140 L226 172',
  'M240 178 L254 148 L268 178',
  'M180 298 L180 344 L212 344',
  'M248 298 L248 344 L280 344',
  'M300 250 C330 250 344 262 344 276',
]

const robot = [
  'M138 62 L262 62 L262 152 L138 152 Z',
  'M200 62 L200 30',
  circlePath(200, 22, 11),
  circlePath(172, 102, 13),
  circlePath(228, 102, 13),
  'M168 130 L232 130',
  'M118 166 L282 166 L282 288 L118 288 Z',
  'M118 192 L78 192 L78 258',
  'M282 192 L322 192 L322 258',
  circlePath(200, 226, 30),
  'M152 288 L152 348 L186 348 L186 288',
  'M214 288 L214 348 L248 348 L248 288',
]

const ball = [
  circlePath(200, 200, 122),
  'M200 138 L246 172 L228 226 L172 226 L154 172 Z',
  'M200 138 L200 78',
  'M246 172 L303 154',
  'M228 226 L263 275',
  'M172 226 L137 275',
  'M154 172 L97 154',
]

const rainbow = [
  ...[170, 138, 106, 74, 42].map((r) => `M${200 - r} 300 A${r} ${r} 0 0 1 ${200 + r} 300`),
  cloudPath(72, 300, 1),
  cloudPath(328, 300, 1),
]

const car = [
  'M55 255 L55 195 L105 185 L145 125 L265 125 L315 185 L345 195 L345 255 Z',
  'M155 137 L200 137 L200 183 L125 183 Z',
  'M215 137 L258 137 L293 183 L215 183 Z',
  'M207 183 L207 255',
  circlePath(120, 258, 34),
  circlePath(280, 258, 34),
  circlePath(120, 258, 13),
  circlePath(280, 258, 13),
  circlePath(335, 222, 9),
  'M20 305 L380 305',
]

const cupcake = [
  'M110 225 L132 355 L268 355 L290 225 Z',
  'M150 232 L160 350',
  'M200 232 L200 350',
  'M250 232 L240 350',
  'M108 225 C68 225 78 178 122 182 C108 140 172 132 186 162 C202 118 264 124 258 160 C296 140 326 178 294 192 C334 198 322 232 292 225 Z',
  circlePath(206, 104, 16),
  'M208 88 C214 72 226 64 240 60',
]

export const BLANK_TEMPLATE = { id: 'blank', name: 'דף ריק', emoji: '⬜', paths: [] }

export const TEMPLATES = [
  BLANK_TEMPLATE,
  { id: 'car', name: 'מכונית', emoji: '🚗', paths: car },
  { id: 'rocket', name: 'חללית', emoji: '🚀', paths: rocket },
  { id: 'dino', name: 'דינוזאור', emoji: '🦖', paths: dino },
  { id: 'robot', name: 'רובוט', emoji: '🤖', paths: robot },
  { id: 'ball', name: 'כדורגל', emoji: '⚽', paths: ball },
  { id: 'star', name: 'כוכב', emoji: '⭐', paths: star },
  { id: 'rainbow', name: 'קשת בענן', emoji: '🌈', paths: rainbow },
  { id: 'heart', name: 'לב', emoji: '❤️', paths: heart },
  { id: 'cupcake', name: 'קאפקייק', emoji: '🧁', paths: cupcake },
]

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) ?? BLANK_TEMPLATE
