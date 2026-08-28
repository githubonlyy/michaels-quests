# Michael's Quests — Design Spec

**Date:** 2026-08-28
**Status:** Built (Lior: current directory, cars/dinos/space worlds, boy avatar, gan content)
**Derived from:** Melanie's Quests (`C:\Users\liorg\AI\Melanie_Academia`, github.com/githubonlyy/melanies-quests)

## Summary

Tablet-first web app for Michael (4, gan). Same engine as his sisters' apps — quiz
matches, coins, XP, streaks, daily chest, trophies, parent PIN dashboard, arcade,
My World (dance / draw / drive) — with four changes:

1. **Content is gan-level and never written.** Counting to 10, colors, shapes and
   patterns, letter recognition, more/less, picture matching. Every prompt and
   every answer is spoken by Hebrew TTS. No reading, no arithmetic, no timers.
2. **Shorter matches.** 6 questions, win at 4, draw at 3, daily goal 2 subjects —
   a four-year-old's attention span, not a first-grader's.
3. **His worlds.** מכוניות 🚗 / דינוזאורים 🦖 / חלל 🚀, picked on every launch.
4. **Boy avatar.** The `dress` slot became `outfit` (shirt + trousers); new hair,
   head gear, hand items and back items; the doll's face lost the eyelashes.

## Locked Decisions

| Topic | Decision |
|---|---|
| Local path | `C:\Users\liorg\AI\Claude\Personal\Micheal_Academia` (chosen over the sibling `AI\Michael_Academia`) |
| Repo | `githubonlyy/michaels-quests`, public, GitHub Pages via Actions on push to `master` — live at https://githubonlyy.github.io/michaels-quests/ |
| Language | Hebrew-only UI, root `dir="rtl"`, masculine phrasing throughout. Icons + TTS carry all meaning |
| Stack | Unchanged: Vite + React 19 + Tailwind v4 + lucide-react, localStorage key `michaels-quests-v1`, Vitest, oxlint |
| Match format | 6 questions/match, no per-question timer, win ≥4, draw 3, loss <3 |
| Economy | 10 coins/correct, +50 win bonus, daily chest 100 after `dailyGoal: 2` subjects. Replays = XP only |
| Themes | 3, picked on every page load; last pick remembered as the highlighted card |
| Avatar | Slots: skin, hair, **outfit**, shoes, head, hand, back, pet. 63 items, bought once, equipped per world |
| Arcade | Same 4 mechanics (catch, flappy, breaker, whack), reskinned per world, still gated behind the daily goal |

## Subjects (events)

| id | Title | Widget | Modes | Bank shape |
|---|---|---|---|---|
| `counting` | ספירה | CountObjects | classic, balloon | `{ emoji, n }`, n ∈ 1..10 |
| `colors` | צבעים | BigTiles (`color` tiles) | classic | `{ kind:'swatch'\|'object', ask:'#hex', name, options:[4 hex] }`, object items add an `emoji` ("באיזה צבע הבננה?") |
| `shapes` | צורות | BigTiles (shape / emoji) | classic | shape pick over 8 shapes, plus A-B-A-B pattern items |
| `letters` | אותיות | BigTiles (text) | classic, balloon | hear-the-letter over all 27 forms + "באיזו אות מתחילה 🍎?" |
| `compare` | גדול וקטן | TwoChoice | classic | piles of 1..6 at least 2 apart, plus digits 1..9 |
| `match` | התאמה | BigTiles (emoji) | classic, pairs | `{ emoji, match }` picture pairs (🐮→🥛), also the memory board |

`BigTiles` gained a `color` tile kind (a ringed swatch, so white reads on the
white tile). `reading.json` and `math.json` were deleted with their engine
branches; `buildPairs` now always builds picture pairs from the match bank.

## Worlds

`themes.js` exports `THEMES = { cars, dinos, space }` — CSS vars, confetti,
particles, four arcade skins and an `avatarPreset` each. Starter dolls differ
because each world tags its own free wardrobe items:

- **cars** — racing suit + racing helmet, red sneakers to buy, mohawk, toy car / wrench / chequered flag.
- **dinos** — dino suit + dino hood, spiky black hair, forest boots, bone, tail, dino & parrot pets.
- **space** — spacesuit + astronaut helmet + jetpack, silver suit, star pyjamas, ray gun, robot & alien pets.

`defaultEquipped` no longer falls back across worlds for *optional* slots — that
fallback used to strap the space jetpack onto the racing driver.

## Avatar

`avatar/parts/outfit.jsx` replaces `dress.jsx`: tshirt, hoodie, racer, dinosuit,
spacesuit, overalls, jersey, pajamas — each a shirt block, sleeves (short cuffs
or long strokes) and trousers/shorts over the same doll skeleton. Hair is short,
spiky, buzz, curly, mohawk, wavy. Head gear: cap, beanie, racing helmet, space
helmet, dino hood, goggles, headphones, crown. Hand: ball, toy car, wrench, bone,
flag, ray gun, ice cream. Back: backpack, jetpack, dino tail, cape, wings.

`avatarRender.test.jsx` renders every wardrobe item through `react-dom/server`
and fails on an empty draw, a `NaN` coordinate or a variant that is never sold.

## My World

Drawing pages are now car, rocket, dino, robot, football, star, rainbow, heart,
cupcake; stickers and the drive-game car skins follow the three worlds.

## Out of Scope

Cloud sync, multi-kid profiles, English, arithmetic (comes with kita א').
