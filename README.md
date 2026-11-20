[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ArulAdiSanjaya/vice-coast-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/ArulAdiSanjaya/vice-coast-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Vice Coast Cover Studio — make.fun bounty gta6-cover-art-01

Entry for make.fun's ["Make GTA 6 Cover Art" bounty](https://make.fun/bounty/gta6-cover-art-01).

A web app that turns a person's photos and a caption into cover art in the
multi-panel poster style: a collage of photo panels with bold ink dividers, a
sunset-or-neon colour grade, and stacked block lettering — exported as a PNG
in the common post sizes (1080 × 1080, 1080 × 1350, 1920 × 1080). It runs
fully offline in a desktop browser from its own static files; photos are read
locally and never leave the machine. All artwork, lettering and code are
original — no Rockstar Games logo, artwork or fonts.

## Run it

```sh
node serve.ts          # serves app/ at http://localhost:8080
```

Open the page, add a photo (or try a bundled sample), set the caption, pick a
layout and grade, and export.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library.
