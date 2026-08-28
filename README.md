# Michael's Quests · המסע של מיכאל

Tablet-first learning game for a four-year-old in gan. Same engine as
[Melanie's Quests](https://github.com/githubonlyy/melanies-quests) and
[Tommy's Quests](https://github.com/githubonlyy/tommys-quests), retuned for a
pre-reader who is also pre-counter: six short subjects, Hebrew text-to-speech on
every prompt and every answer, no timers, three pick-each-time worlds
(מכוניות / דינוזאורים / חלל), and a boy avatar that coins buy clothes for.

- Design spec: [docs/superpowers/specs/2026-08-28-michaels-quests-design.md](docs/superpowers/specs/2026-08-28-michaels-quests-design.md)

## Develop

```powershell
cd app
npm ci
npm run dev      # http://localhost:5173 — host:true so the tablet on the same WiFi can open it
npm test         # vitest
npm run lint     # oxlint
npm run build
```

Deploys to GitHub Pages on push to `master` (`.github/workflows/ci.yml`) once the
repo exists. `deploy.ps1` is a manual fallback.

## Parent notes

- Six subjects: ספירה 1–10, צבעים, צורות ודפוסים, זיהוי אותיות, גדול/קטן, התאמה.
  6 questions per match, no timer, win at 4 correct.
- Parent tab PIN defaults to `1234` — change it on first use (הורים → החלפת קוד).
- Questions live in `app/src/data/questions/*.json` — plain JSON, edit freely.
- Real-world rewards are `app/src/data/shop.json`; avatar clothes are `app/src/data/wardrobe.json`.
- Economy knobs: `app/src/data/config.json` (questions per match, win threshold, daily goal 2, chest).
- Everything is stored in the browser's localStorage (`michaels-quests-v1`); clearing site data resets progress.
