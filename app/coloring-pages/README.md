# דפי צביעה של המשפחה — family coloring pages

Every image in this folder becomes a page מיכאל can color, listed under
**המשפחה שלי 💙** in the drawing screen next to the built-in pages. No manifest,
no code change: drop the file in, commit, push.

```text
app/coloring-pages/
  דינוזאור.jpg          →  tile "דינוזאור"
  בית-הקסמים.png        →  tile "בית הקסמים"
  רכבת.svg              →  tile "רכבת"
```

Subfolders work too — the glob is recursive, so `2026/פרח.png` becomes a page
called "פרח" exactly like a file sitting at the top level. Use them to keep a
big folder tidy; the app does not group by folder, it just finds everything.

## File types

Anything the browser can decode: **`.png` `.jpg` `.jpeg` `.webp` `.svg`** are the
ones worth using, and `.gif .bmp .avif .apng .ico .jfif` are accepted as well.
The extension is matched **case-insensitively**, so `SCAN.JPG` works.

**Nothing is ever dropped in silence.** A file in this folder that does not
become a page is named in the browser console at startup, with the reason:

```text
[coloring-pages] "IMG_4021.HEIC" is not a coloring page: HEIC is the iPhone
camera default and no browser can decode it — export it as JPEG …
```

So if a picture does not show up on the tablet, open DevTools on the deployed
site and the answer is sitting in the console. The same list is exported as
`SKIPPED_PAGES` from `../src/world/draw/familyPages.js`.

**HEIC is the one to watch for.** It is the iPhone camera default and no browser
can decode it. It gets its own message, but the fix is on your side: export as
JPEG (Photos → export), or set the camera to *תואם ביותר* / Most Compatible so it
shoots JPEG in the first place. Do **not** just rename a `.heic` to `.jpg` — the
bytes are still HEIC, the file then gets a tile, and the tile fails to decode.
That case is handled (the app says `הדף הזה לא נטען` out loud and drops back to
the blank page) but you still have no coloring page.

RAW files (`.cr2 .nef .arw .dng`), `.tif/.tiff`, `.psd`, `.ai`, `.eps` and `.pdf`
each get their own "export it as …" message. Housekeeping — this README,
`.gitkeep`, `Thumbs.db`, `desktop.ini` — is ignored quietly, as it should be.

Two kinds of input, and they take different paths through the code:

| Input | What happens |
| --- | --- |
| Photo or scan of a printed page (`.jpg`, `.png`, `.webp` on white paper) | Full ink pipeline — trim, background estimate, key to alpha. See below. |
| Already-keyed art — a PNG with a real transparent background, or an SVG | Passed through untouched. No trim, no keying. |

The alpha channel is what decides: a raster file with even one non-opaque pixel
is treated as keyed art already. Keying it a second time used to produce a
completely invisible page, so it is now detected and skipped.

If you have the option, export already-keyed art. It is the cleanest input and
it costs nothing at load time.

## Naming

The **filename is the page name**, shown under the tile and read aloud when he
picks it, so name it in Hebrew.

- `_` and `-` become spaces: `בית-הקסמים.png` → "בית הקסמים". Real spaces and
  parentheses are left alone: `דף 1 (עותק).jpg` reads exactly like that.
- The page **id carries the extension**, so `סבתא.png` and `סבתא.jpg` are two
  separate pages — neither one shadows the other. Same name in two different
  subfolders (`2025/דף.png` and `2026/דף.png`): also two pages, and each one is
  qualified by a hash of its own path so that **neither holds the plain id**.
- **A page id never moves.** It is a function of the file alone, never of the
  order the folder happened to be read in, so adding a picture cannot rename the
  ones already there. That matters because the app remembers the open page by id
  from one session to the next: an id that shifts reopens the wrong picture. The
  one thing that does move an id is *deleting* one of two files whose names slug
  the same — the survivor goes back to the plain id, and the app falls back to
  the blank page rather than opening something else.
- **Two tiles can share a name.** `סבתא רחל.png` and `סבתא-רחל.png` both read
  "סבתא רחל", so the tiles show the *filenames* instead — and a counter if even
  those match. He still hears the plain name read aloud. Tiles allow two lines of
  text for exactly this reason.
- A name made only of emoji still gets a stable id, so `🦖.png` works.
- Pages are sorted by name with a Hebrew collator, so numbering the stems is the
  only way to force a particular order.

## What keys well

The pipeline lives in `../src/world/draw/pageInk.js`. On a photographed page it
finds the paper's bounding box and crops the desk away, estimates the lighting
**from the paper pixels only**, divides it out so cream paper flattens to white,
then turns paper into transparent and ink into solid black. The template floats
above his canvas, so he paints underneath and the lines stay crisp.

Shoot for it:

- **The page does not have to fill the frame.** Trimming looks for the paper's
  bounding box, not a fixed margin, so a page sitting in the middle of a phone
  photo with desk all round is cropped correctly. `TRIM_MAX` (35% a side) is only
  a safety net for a picture with no recognisable paper in it.
- **But do get closer than about an arm's length.** Under `TRIM_MIN_PAPER` (8% of
  the frame being paper) there is nothing worth cropping to, so the picture is
  kept whole. The desk is keyed away rather than turning black, but the drawing
  then sits small in the middle of a big transparent sheet and stays that size on
  the tablet.
- **A little tilt is fine.** The desk left in the corners of the bounding box is
  cleared row by row, so a page lying at an angle on the table no longer keys
  into black wedges.
- **The table can be light.** A pale wooden desk used to be mistaken for the
  paper — it is most of the frame and one flat tone, while the shaded page is
  spread thin — and the result was that nothing got cropped at all and the
  table's own grain keyed as a black sheet over his painting. The paper level is
  now read off the brightest population rather than the biggest one, and the
  paper/desk line drops into the valley between the two when a light table makes
  one. Tables from near-black up to about 175 all crop correctly, with or without
  grain. A table *brighter* than that (bare white melamine, a sheet of A3 under
  the page) is still too close to the paper to separate: nothing is cropped and
  a strongly textured one can key grey. Put the page on something darker.
- **Even light.** A smooth gradient is divided out; a hard shadow *edge* still
  keys as ink. The crop is the fussier half — it runs on the raw photo, and a
  shadow that drops one side of the page well below the rest can get that side
  cut off the page.
- **Square-on, not at a steep angle.** Perspective is never corrected — a
  keystoned page stays keystoned.
- **Full-bleed art is safe.** When the paper runs off the edge of the photo there
  is no table beside it, so a solid band of ink along that edge is recognised as
  artwork and **nothing at all** is trimmed from that side (`TRIM_SAFE`). A thin
  title bar used to be swallowed whole and silently.

What still comes out badly:

- **Marks within a few percent of the paper's own brightness.** The paper/ink
  cuts are read off each page's own histogram, so ordinary pencil now keys
  properly (it used to end up at about a third of full alpha and then vanish in
  the faint display mode). Something barely darker than the paper still goes.
- **Very light grey fills.** Anything above ~78% of the local paper level counts
  as paper and flattens to white. A *dark* filled shape — black hair, a thick
  frame, a solid title bar — keeps its solid inside; that used to come out as a
  ring with a hole in it.
- **Photographs of people, pets, landscapes.** This is a line-art keyer, not a
  cartoonizer. Continuous tone turns to mush, and colour is discarded outright:
  the output is black-only, whatever the input was.

The thresholds (`PAPER_CUT`, `INK_CUT`, `TRIM_MAX`, `TRIM_SAFE`, `TRIM_SMOOTH`,
`TRIM_MIN_PAPER`, `BLUR_DIVISOR` and the `ADAPT_*` / `BG_*` / `PAPER_*`
constants) are exported and unit tested — tune them in `pageInk.js` if a whole
batch of photos keys badly.

## Size

**~2000px on the long side is plenty.** The image is downscaled to 1400px
(700px for a picker thumbnail) *before* any processing, so resolution above that
is thrown away.

Oversized files cost twice: they are bundled into the site and downloaded by the
tablet, and opening the page picker asks for *every* family thumbnail at once.
Those runs are queued one at a time with a frame handed back to the browser
between them, so the tablet stays responsive — but a folder of untouched 4032px
iPhone photos still makes the picker slow to fill in. Six full-size pages and 48
thumbnails stay in memory after that.

## The two page modes — קווים / שקוף

When a family page is open, a button appears in the top bar (it does not exist
for the built-in pages). Its icon and its label name **what the tap will do**:

- **דף שקוף** (ghost icon) — fade the lines to 22% opacity, for tracing: he
  draws over the faint guide and ends up with his own lines.
- **קווים כהים** (pencil icon, highlighted) — bring the lines back to full
  strength. The normal coloring mode.

The choice is per page and is saved (`michaels-quests-page-modes`), but a page
always **opens** with dark lines — picking it from the shelf, or reopening the
board on it, resets it. One stray tap can never leave a page nearly invisible
the next day.

The page he was last on is remembered too (`michaels-quests-draw-page`), so
closing the drawing screen and coming back keeps him on the same picture instead
of dropping him to a blank sheet.

Whatever opacity he is looking at is also what gets baked into the saved picture,
so a page saved in שקוף mode looks on the shelf exactly like it did on the board.

## When it doesn't work

| What you see | What it means |
| --- | --- |
| No tile at all for a file you added | It was skipped — the browser console names it and says why at startup. |
| Buzz, **"הדף הזה לא נטען"**, back to the blank sheet | The browser could not decode the file at all: a HEIC renamed to `.jpg`, a truncated download. |
| The page is always washed out, even after tapping קווים כהים | Keying failed, and the app is showing the untouched photo faintly so he still has something to trace. Reshoot it. |
| A black band along the top or bottom | Too much desk in the frame above or below the page — get closer, or square it up. |
| The drawing sits tiny in the middle of the sheet | The paper was under 8% of the photo, so nothing was cropped. |
| Grey haze over the whole page | The table was nearly as light as the paper. Shoot it on something darker. |

## Getting it onto his tablet

```powershell
git add app/coloring-pages/
git commit -m "Add coloring page: דינוזאור"
git push
```

Push to `master` runs `.github/workflows/ci.yml` (lint, test, build) and deploys
to GitHub Pages. Give it a couple of minutes, then hard-refresh
https://githubonlyy.github.io/michaels-quests/ on the tablet.

## Privacy — read this before you name a file

**This repo is public** (`github.com/githubonlyy/michaels-quests`) and the site
sits at a guessable GitHub Pages URL. Everything here is published twice: the
image file itself is browsable in the repo, and it is bundled into the deployed
site. The **filename travels with it** — into the repo listing, into the commit
message, and onto the tile in the app.

So name the *picture*, not the child, and not where the photo was taken:
`דינוזאור.jpg`, `רכבת.png`, `טירה.svg`. The page name is what he sees under the
tile anyway, and a neutral one reads just as well. Commit line art, not
photographs of the kids.
