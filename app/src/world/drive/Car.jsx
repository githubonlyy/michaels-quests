// Top-down SVG car with an open cabin the doll sits in. One colour scheme per
// world; the parent drops an <Avatar> in as children and only his top half
// shows through the cabin cut-out.

export const CAR_W = 88
export const CAR_H = 136
// cabin cut-out (design px) — the doll is clipped to this box
const CABIN = { x: 14, y: 46, w: 60, h: 60 }
// doll height so that his top ~45% (head + shoulders) fills the 60px cabin box
export const DOLL_SIZE = 132

const SKINS = {
  cars: { body: '#ef4444', dark: '#991b1b', seat: '#fff1f2', glass: '#e0f2fe', deco: 'stripes' },
  dinos: { body: '#22c55e', dark: '#15803d', seat: '#f0fdf4', glass: '#e0f2fe', deco: 'claw' },
  space: { body: '#818cf8', dark: '#4338ca', seat: '#eef2ff', glass: '#e0f2fe', deco: 'stars' },
}

const carSkin = (themeId) => SKINS[themeId] || SKINS.cars

function Deco({ kind }) {
  if (kind === 'claw') {
    // three dino claw marks raked across the hood
    return (
      <g stroke="#fde047" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.95">
        <path d="M32 14 L38 40" />
        <path d="M44 12 L44 42" />
        <path d="M56 14 L50 40" />
      </g>
    )
  }
  if (kind === 'stars') {
    return (
      <g fill="#fde047" opacity="0.95">
        {[[44, 18, 6], [32, 34, 4], [58, 32, 4]].map(([cx, cy, r]) => (
          <path key={`${cx}-${cy}`} d={`M${cx} ${cy - r} L${cx + r * 0.3} ${cy - r * 0.3} L${cx + r} ${cy} L${cx + r * 0.3} ${cy + r * 0.3} L${cx} ${cy + r} L${cx - r * 0.3} ${cy + r * 0.3} L${cx - r} ${cy} L${cx - r * 0.3} ${cy - r * 0.3} Z`} />
        ))}
      </g>
    )
  }
  // cars: two racing stripes down the hood
  return (
    <g fill="#ffffff" opacity="0.9">
      <rect x="38" y="12" width="5" height="30" />
      <rect x="46" y="12" width="5" height="30" />
    </g>
  )
}

export default function Car({ themeId, children }) {
  const s = carSkin(themeId)
  return (
    <div className="relative" style={{ width: CAR_W, height: CAR_H }}>
      <svg viewBox={`0 0 ${CAR_W} ${CAR_H}`} width={CAR_W} height={CAR_H} className="absolute inset-0" aria-hidden="true" focusable="false">
        {/* wheels */}
        {[
          [2, 24],
          [74, 24],
          [2, 94],
          [74, 94],
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="12" height="26" rx="4" fill="#1f2937" />
        ))}
        {/* body */}
        <rect x="8" y="6" width="72" height="124" rx="24" fill={s.body} stroke={s.dark} strokeWidth="3" />
        {/* hood sheen + headlights */}
        <rect x="16" y="14" width="56" height="26" rx="12" fill="#ffffff" opacity="0.2" />
        <circle cx="22" cy="12" r="4" fill="#fef9c3" stroke={s.dark} strokeWidth="1.5" />
        <circle cx="66" cy="12" r="4" fill="#fef9c3" stroke={s.dark} strokeWidth="1.5" />
        <Deco kind={s.deco} />
        {/* windshield */}
        <path d="M16 42 h56 l-4 10 h-48 z" fill={s.glass} opacity="0.95" stroke={s.dark} strokeWidth="1.5" />
        {/* open cabin / seat */}
        <rect x={CABIN.x + 2} y={CABIN.y + 8} width={CABIN.w - 4} height={CABIN.h - 6} rx="12" fill={s.seat} stroke={s.dark} strokeWidth="2" />
        {/* trunk + tail lights */}
        <rect x="16" y="112" width="56" height="10" rx="5" fill="#ffffff" opacity="0.15" />
        <rect x="18" y="122" width="12" height="5" rx="2.5" fill="#fb7185" />
        <rect x="58" y="122" width="12" height="5" rx="2.5" fill="#fb7185" />
      </svg>
      {/* the doll: her head and shoulders peek over the seat */}
      <div
        className="absolute overflow-hidden flex justify-center"
        style={{ left: CABIN.x, top: CABIN.y, width: CABIN.w, height: CABIN.h, borderRadius: 14 }}
      >
        {/* Avatar caps itself at maxHeight:100%, so give it a box of its own height */}
        <div style={{ height: DOLL_SIZE, flex: 'none' }}>{children}</div>
      </div>
    </div>
  )
}
