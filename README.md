[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ArulAdiSanjaya/vice-coast-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/ArulAdiSanjaya/vice-coast-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Vice Coast Cover Studio — make.fun bounty gta6-cover-art-01

My entry for make.fun's ["Make GTA 6 Cover Art" bounty](https://make.fun/bounty/gta6-cover-art-01).

Vice Coast Cover Studio is a small cover-art maker that turns your own
photos into a multi-panel poster cover in the collage style: several photo
panels split by thick ink dividers, a strong colour grade over the whole
frame, and stacked block lettering along the foot — a bold uppercase title
with a dark outline and an accent-colour offset shadow, plus an accent
subtitle and bar. You frame each panel yourself (drag to pan, slide to
zoom), then export a finished PNG in the size you need.

Everything is original work written for this bounty: the layout engine, the
grades and the lettering are drawn with plain canvas code and generic font
stacks. No Rockstar Games logos, artwork or fonts are used anywhere.

## Features

- **Four multi-panel layouts** — Hero + side stack, Quad grid, Triptych
  strips and Split duo. Panels cycle through your photos in order.
- **Per-panel framing** — select a panel chip, drag on the cover to pan
  that panel's photo, and use the zoom slider to tighten or loosen its
  cover-fit crop.
- **Four colour grades** — Vice sunset, Neon night, Golden hour and
  Midnight noir. Each combines a gradient wash with a saturation/contrast
  lift, and recolours the caption accent to match.
- **Caption block** — title and subtitle inputs; the title is stacked and
  auto-fitted to the frame width automatically.
- **Three export sizes** — 1080 × 1080 (square), 1080 × 1350 (portrait)
  and 1920 × 1080 (wide), exported as a PNG in one click. The live preview
  switches to the chosen size so what you see is what you export.
- **Private by construction** — the app is plain static files, makes no
  network requests, and reads photos locally through object URLs. Nothing
  is uploaded, ever. Two bundled sample photos (made with an image model)
  are included so the studio works before you add your own.

## Run it

```sh
node serve.ts          # serves app/ at http://localhost:8080
```

Open the page, add photos (or use a sample), pick a layout and grade, type
your caption, frame each panel, and press **Export PNG**.

Screenshot scenes are built in for rendering the shots in `screenshots/`:
`?shot=cover&photo=pier&layout=hero&grade=vice&title=Vice%20Coast` fills the
window with a finished cover, and `?shot=editor&photo=boulevard` opens the
editor with a sample loaded. `render-shots.py` (Python + PIL) mirrors the
same rendering math to produce those screenshots offline.

## Hand it in

```sh
python3 render-shots.py                              # refresh screenshots/
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts  # build the hand-in
```

`main.ts` validates the screenshots against the gate caps (3–4 images,
each at most 262144 bytes, with a real PNG/JPEG signature), copies `app/`
and `screenshots/` to the output directory, and writes `dossier.json`
there with the vendored make.fun library (`vendor/makefun-app.ts`, left
byte-identical to the kit).
