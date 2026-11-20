// Vice Coast Cover Studio — hand-in program (Node 22, standard library only).
//
// Copies the static web app in app/ and the renders in screenshots/ from
// beside this file into the output directory, checks the screenshots against
// the bounty gate's caps before anything is handed in, and writes
// dossier.json there with the vendored make.fun library.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Without MAKEFUN_OUTPUT_DIR the output directory is /output, as in the
// grader's container.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate caps this entry is held to (kept in one place so the validation
// below and the dossier call can never drift apart).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};
const MIN_SCREENSHOTS = 3;
const IMAGE_NAME = /\.(?:png|jpe?g)$/i;

/** Fail loudly with a message the author can act on. */
function refuse(message) {
  throw new Error(`vice-coast: ${message}`);
}

/** The screenshot files in screenshots/, sorted by name (first is the cover). */
function screenshotFiles(dir) {
  if (!existsSync(dir)) refuse('screenshots/ is missing — run render-shots.py first');
  return readdirSync(dir)
    .filter((name) => IMAGE_NAME.test(name))
    .sort();
}

/** True when the file's first bytes are a PNG or JPEG signature. */
function hasImageSignature(path) {
  const head = readFileSync(path).subarray(0, 8);
  const isPng = head.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => head[i] === b);
  const isJpeg = head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  return isPng || isJpeg;
}

/**
 * Check the screenshots against the gate caps: count, per-file bytes, and
 * that each file really is a PNG or JPEG (the dossier builder refuses
 * anything else, so catching it here gives the author a clearer message).
 * Logs each accepted file with its size.
 */
function validateScreenshots(dir) {
  const names = screenshotFiles(dir);
  if (names.length < MIN_SCREENSHOTS || names.length > CAPS.screenshots.max) {
    refuse(`screenshots/ holds ${names.length} images; the gate wants ${MIN_SCREENSHOTS}-${CAPS.screenshots.max}`);
  }
  for (const name of names) {
    const path = join(dir, name);
    const bytes = statSync(path).size;
    if (bytes > CAPS.screenshots.max_bytes) {
      refuse(`screenshots/${name} is ${bytes} bytes; the cap is ${CAPS.screenshots.max_bytes}`);
    }
    if (!hasImageSignature(path)) {
      refuse(`screenshots/${name} has no PNG or JPEG signature`);
    }
    console.log(`vice-coast: screenshot ${name} ok (${bytes} bytes)`);
  }
  return names;
}

const shotsDir = join(here, 'screenshots');
const names = validateScreenshots(shotsDir);
if (!existsSync(join(here, 'app', 'index.html'))) refuse('app/index.html is missing');

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, CAPS);
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`vice-coast: handed in app/ + ${names.length} screenshots (${names.join(', ')}) to ${out}`);
console.log(`vice-coast: dossier.json is ${dossier.byteLength} bytes`);
