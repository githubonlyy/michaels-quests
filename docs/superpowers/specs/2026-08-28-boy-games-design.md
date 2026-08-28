# Boy Games — Design Spec

**Date:** 2026-08-28
**Status:** Approved (Lior: both new subjects and new mechanics; keep the 4 existing arcade games; mixed controls with generous assists; rotating board of 6; shared drawing, separate loops; branch per phase with a PR)
**Builds on:** [2026-08-28-michaels-quests-design.md](2026-08-28-michaels-quests-design.md)

## Summary

Michael's Quests currently teaches six subjects through four widgets and rewards
study with four reskinned arcade games. This adds what a four-year-old boy
actually asks for: four more subjects from his world, and three new mechanics —
motorcycle, archery, web-slinging — each appearing twice, once as an arcade game
he buys with coins and once as an answer mode inside a lesson.

Three phases, each shippable on its own:

1. **Subjects & board** — 4 new subjects, and a board that shows 6 a day instead of all 10.
2. **Arcade** — shared sprite drawing plus 3 new games (7 total).
3. **Teaching modes** — the same 3 mechanics as MatchEngine answer modes.

## Locked Decisions

| Topic | Decision |
|---|---|
| Scope | Both new subjects **and** new mechanics |
| Existing arcade | All 4 stay (catch, flappy, breaker, whack); the 3 new ones are added → 7 |
| Controls | Mixed: drag for continuous aim/steer, one tap for discrete fire/sling. Generous assists (angle snap, lane snap, missed-sling recovery). No tilt, no multi-touch |
| Board | 6 subjects a day (deterministic rotation) + "עוד משימות" to reveal all 10 |
| Architecture | Shared drawing (`arcade/sprites.js`), separate loops: arcade = canvas + RAF endless; teaching = React widget inside MatchEngine's 6-question loop |
| Delivery | Branch per phase, PR with green CI and screenshots, Lior merges. `master` protected (PR required, `build` check required, no force-push, admin bypass left on) |

## Phase 1 — Subjects & board

### New subjects

Four new entries in `data/events.js`, four new banks in `data/questions/`. All
four answer through the existing `BigTiles` widget, so no new widget code.

| id | כותרת | Widget | Kinds | Items |
|---|---|---|---|---|
| `vehicles` | רכבים ומקצועות 🚒 | BigTiles emoji | `who` — "מי מכבה את הדליקה?" → 🚒 · `where` — "מי נוסע בים?" → 🚤 (יבשה/ים/אוויר) | ≥34 |
| `sounds` | קולות בעלי חיים 🐮 | BigTiles emoji | `{ sound:'מוּ', answer:'🐮' }` — TTS says the sound, he picks the animal | ≥30 |
| `digits` | ספרות 🔢 | BigTiles text | `hear` — "איפה המספר שבע?" · `dots` — a pile of dots is shown, he picks the digit | ≥30 |
| `opposites` | הפכים ↔️ | BigTiles emoji | `{ emoji:'🔥', answer:'❄️' }` — "מה ההפך מחם?" | ≥30 |

Every item carries `speak` and `answerSpeak` and 4 unique options containing the
answer exactly once — the contract `banks.test.js` already enforces, which is
also where the 30-item floor comes from. No audio files: animal sounds are
spoken by Hebrew TTS, so a device without an
he-IL voice degrades exactly as the other subjects do (prompt text stays on
screen, 🔊 button stays visible).

`digits` `dots` items reuse the existing `count` prompt display (`EmojiGrid`)
with digit tiles as the options, so counting objects and reading a numeral stay
separate skills.

### Board rotation

New pure function, `data/board.js`:

```js
dailySubjects(businessDateStr, events, size = 6) -> Event[]
```

A day index derived from the date string picks the window start; the window of
`size` slides over the stable `EVENTS` order and wraps. Properties the tests
pin down: stable within a day, different between consecutive days, every subject
appears at least once across any 10-day span, and the returned length is
`min(size, events.length)`.

`EventBoard` renders the daily set, then a full-width card row
**"עוד משימות ⬇️"** that reveals the remaining four (state is local, not
persisted — a fresh launch is back to six). The daily chest and the
`dailyGoal: 2` counter keep counting *all* subjects, so a subject played from
the expanded list still counts.

## Phase 2 — Arcade: motorcycle, archery, slinger

### Shared drawing

New `arcade/sprites.js`, canvas draw helpers used by both the arcade games and
the phase-3 teaching modes:

- `drawEmoji(ctx, ch, x, y, size, rot)` — moved here from `Catch.jsx`, where each
  game currently keeps its own copy. The other games switch to the shared one.
- `drawRider(ctx, x, y, { skin, helmet, lean })` — the doll's head and torso on a
  motorcycle silhouette.
- `drawArcher(ctx, x, y, { angle, drawn })` — the doll with a bow, arm on `angle`.
- `drawSwinger(ctx, x, y, { anchor, swing })` — the doll hanging from a web line.

Sprites take colors from the equipped avatar (skin tone, outfit main color) so
the rider on screen is *his* doll, the way `Drive.jsx` already does it.

### The three games

Each is a canvas + RAF loop with state in a ref, wrapped in the existing
`ArcadeShell` (HUD, themed backdrop, Hebrew game-over card), and each keeps its
geometry in a sibling `logic.js` of pure functions — the pattern
`world/drive/logic.js` already establishes.

| Game | id | Mechanic | Assists for a 4-year-old |
|---|---|---|---|
| אופנוע 🏍️ | `moto` | 3-lane endless road. Drag or tap left/right to change lane. Collect the world's fuel/coin item, dodge its hazard. 60s, 3 hearts, slow speed ramp | lane snap, one hazard at a time, hazard-free first 5 seconds |
| קשת 🏹 | `archery` | Targets glide across at 2–3 heights. Drag sets the bow angle, tap releases an arrow on a parabola. Good target +10, bomb target costs a heart. 60s | angle snaps to the nearest target within tolerance, no wind, fixed power |
| מטפס 🕸️ | `sling` | The screen scrolls up. Anchor points sit above; tap one and the doll swings to it, collecting coins and diamonds along the arc. Falling off the bottom costs a heart | a tap that misses still grabs the nearest anchor in tolerance (it loses the gems, not the run); at least one reachable anchor is always on screen; respawn at the last anchor |

Score: `moto` and `archery` count collected items; `sling` counts height in
meters plus gems. All three report through the existing
`ARCADE_SCORE` action, so high scores, the arcade card and the trophies work
without changes.

### Theme skins

`themes.js` gains `theme.arcade.moto`, `.archery`, `.sling` for all three
worlds — titles, hero and hazard sprites, brick/gem colors. Existing
`gameMeta()` resolves them, and `arcade.test.js` already asserts every game key
exists in every world's skin map, so a missing skin fails the suite.

Example per world:

| | cars 🚗 | dinos 🦖 | space 🚀 |
|---|---|---|---|
| `moto` | אופנוע מרוצים · ⛽ / 🔩 | אופנוע ביער · 🥚 / 🌋 | אופנוע ירח · ⭐ / ☄️ |
| `archery` | ירי למטרה · 🎯 / 💣 | קשת הדינו · 🥚 / 🌋 | ירי בחלל · ⭐ / ☄️ |
| `sling` | טיפוס בגראז' · 🪙 / 💎 | טיפוס בעצים · 🪙 / 💎 | טיפוס בחלל · 🪙 / 💎 |

## Phase 3 — Teaching modes

Three new entries in `MODES` beside `balloon` and `pairs`, each a widget in
`match/widgets/` that reuses `sprites.js` but answers in MatchEngine's normal
6-question loop. Scoring, coins, XP, streak, trophies and the daily-play rule
are untouched.

| Mode | Hebrew label | How he answers | Options |
|---|---|---|---|
| `archery` | ירי למטרה | 4 targets carry the options; tap the right one. A wrong arrow bounces off, the correct target then glows | 4 |
| `ride` | אופנוע | 3 gates across the road, each showing an option; steer into the correct gate before the line | 3 |
| `sling` | מטפס | 4 platforms above, each with an option; tap the correct one and the doll swings up in a coin burst | 4 |

MatchEngine gains three pure builders next to `buildClassic` / `buildBalloon` —
`buildArchery`, `buildRide`, `buildSling` — taking `(eventId, q, bank)` and
returning the prepared-question shape already documented in the file. `ride`
needs only three options, so its builder keeps the answer and samples two
decoys; a bank item that cannot produce three distinct options falls back to
`buildClassic` rather than rendering a broken gate.

Which subject offers which mode (`events.js`):

| subject | modes |
|---|---|
| counting | classic, balloon, sling |
| colors | classic, archery |
| shapes | classic, archery |
| letters | classic, balloon, archery |
| compare | classic, ride |
| match | classic, pairs, sling |
| vehicles | classic, ride |
| sounds | classic, sling |
| digits | classic, balloon, archery |
| opposites | classic, ride |

## Economy, trophies, wardrobe

**Prices** — the new games slot into the coin ladder so there is always a next
goal, and the Arcade screen sorts by price:

`catch 0 → אופנוע 1000 → flappy 1500 → קשת 1800 → breaker 2000 → whack 2500 → מטפס 3000`

At goal pace (2 subjects + chest ≈ 320 coins/day) the motorcycle is about three
days away and the climber is the long prize. Arcade games stay behind the daily
goal of 2 subjects. Teaching modes cost nothing — they are part of the subject
card, like balloon and pairs.

**Trophies** (+6 in `data/trophies.js`, with new icon keys mapped in
`screens/Trophies.jsx`): `master-vehicles`, `master-sounds`, `master-digits`,
`master-opposites` (5 wins each), `arcade-collector` (owns all 7 games),
`climber` (a sling record of 100 m or more).

**Wardrobe** (+3 items, 66 total, inside the 55–80 the Closet is tuned for):
`hand-bow` 🏹 (RARE 350, all worlds), `hand-web` web-shooter (RARE 400, space),
`head-moto-helmet` (RARE 300, cars — reuses the existing `helmet` renderer with
its own colors). `hand.jsx` gains `bow` and `web` variants;
`avatarRender.test.jsx` picks all three up automatically.

## Testing

- **Banks** — `banks.test.js` extended to the four new banks: 4 unique options,
  answer exactly once, `speak` + `answerSpeak` present, kind-specific fields.
- **Board** — `dailySubjects()` unit tests: stable within a day, changes between
  days, full coverage over 10 days, correct size.
- **Arcade geometry** — pure `logic.js` tests per game: lane positions and
  collision (`moto`), trajectory, angle snap and hit test (`archery`), swing arc,
  nearest anchor and gems-on-arc (`sling`).
- **Modes** — builder tests: exactly one correct option, correct option count
  (3 for `ride`), fallback to classic when a bank item can't fill three gates.
- **Avatar** — existing render test covers the new wardrobe items.
- **Manual** — headless-Chrome screenshots of each new game and each new mode,
  attached to the phase PR.

## Delivery

| Phase | Branch | PR contents |
|---|---|---|
| 0 | `spec/boy-games` | this document |
| 1 | `feat/new-subjects` | 4 banks, 4 events, `data/board.js`, EventBoard rotation + "עוד משימות", tests |
| 2 | `feat/arcade-moto-bow-sling` | `arcade/sprites.js`, 3 games + `logic.js` each, theme skins, prices, `arcade-collector` / `climber` trophies, tests |
| 3 | `feat/teaching-modes` | 3 mode widgets, 3 MatchEngine builders, `events.js` mode wiring, wardrobe items, tests |

Every PR: CI green (`build` is a required check), screenshots in the body, Lior
merges. Pages deploys only on merge to `master`.

## Edge cases

- A subject whose bank cannot yield three distinct options in `ride` mode falls
  back to `classic` instead of rendering two identical gates.
- No Hebrew voice on the device: unchanged behaviour — text stays on screen, the
  🔊 button stays, `speak()` no-ops.
- Desktop has no touch: the new games bind pointer events, like the existing
  ones, so a mouse works for review and screenshots.
- Tablet performance: one canvas and one RAF loop per game, all game state in a
  ref, no React re-render per frame.
- `sling` can never dead-end — the spawner guarantees a reachable anchor, and a
  fall costs a heart instead of ending the run.
- A saved high score for a game he no longer owns stays in `arcadeHighScores`;
  the Arcade screen already shows only owned games.

## Out of scope

Recorded audio (TTS only), a fourth world, arithmetic, multiplayer, tilt or
gyro controls, new avatar slots, cloud sync.
