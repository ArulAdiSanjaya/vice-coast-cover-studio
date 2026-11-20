// Vice Coast Cover Studio — rendering engine.
//
// Pure canvas work, no imports, no network, no external fonts or artwork.
// Given a list of decoded photos plus editor state, it paints a multi-panel
// poster cover: cover-fitted photo panels separated by thick ink dividers,
// a colour-grade wash, a bottom vignette, and a stacked block-letter caption
// with a dark outline and an accent-colour offset shadow.
//
// The Python screenshot renderer (render-shots.py at the repo root) mirrors
// the layout fractions, grade stops and lettering math defined here, so the
// shipped screenshots show exactly what this engine draws in the browser.

// ---------------------------------------------------------------- layouts
// Panel rectangles are fractions of the whole canvas: [x, y, w, h].
export const LAYOUTS = {
  hero: {
    label: 'Hero + side stack',
    panels: [
      [0, 0, 0.66, 1],
      [0.66, 0, 0.34, 0.5],
      [0.66, 0.5, 0.34, 0.5],
    ],
  },
  quad: {
    label: 'Quad grid',
    panels: [
      [0, 0, 0.5, 0.5],
      [0.5, 0, 0.5, 0.5],
      [0, 0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
    ],
  },
  triptych: {
    label: 'Triptych strips',
    panels: [
      [0, 0, 1 / 3, 1],
      [1 / 3, 0, 1 / 3, 1],
      [2 / 3, 0, 1 / 3, 1],
    ],
  },
  duo: {
    label: 'Split duo',
    panels: [
      [0, 0, 1, 0.58],
      [0, 0.58, 1, 0.42],
    ],
  },
};

export const LAYOUT_ORDER = ['hero', 'quad', 'triptych', 'duo'];

// ---------------------------------------------------------------- grades
// Each grade: a vertical gradient wash (stops of [position, css colour]),
// a saturation / contrast lift applied while the photo is drawn, and the
// accent colour used for the caption shadow, subtitle and bar.
export const GRADES = {
  vice: {
    label: 'Vice sunset',
    accent: '#ff2e9a',
    saturation: 1.35,
    contrast: 1.12,
    stops: [
      [0, 'rgba(255, 94, 58, 0.00)'],
      [0.55, 'rgba(255, 47, 150, 0.18)'],
      [1, 'rgba(64, 0, 96, 0.55)'],
    ],
  },
  neon: {
    label: 'Neon night',
    accent: '#00e5ff',
    saturation: 1.5,
    contrast: 1.18,
    stops: [
      [0, 'rgba(0, 229, 255, 0.08)'],
      [0.6, 'rgba(124, 0, 255, 0.22)'],
      [1, 'rgba(2, 0, 32, 0.62)'],
    ],
  },
  golden: {
    label: 'Golden hour',
    accent: '#ffb020',
    saturation: 1.25,
    contrast: 1.08,
    stops: [
      [0, 'rgba(255, 196, 64, 0.10)'],
      [0.65, 'rgba(255, 122, 24, 0.22)'],
      [1, 'rgba(74, 24, 0, 0.50)'],
    ],
  },
  noir: {
    label: 'Midnight noir',
    accent: '#e8e8f0',
    saturation: 0.55,
    contrast: 1.3,
    stops: [
      [0, 'rgba(0, 0, 0, 0.15)'],
      [1, 'rgba(0, 0, 0, 0.68)'],
    ],
  },
};

export const GRADE_ORDER = ['vice', 'neon', 'golden', 'noir'];

// Generic font stacks only — the lettering is drawn, never loaded.
const TITLE_FONT = (size) => `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
const SUB_FONT = (size) => `700 ${size}px "Helvetica Neue", Arial, sans-serif`;

// ---------------------------------------------------------------- cover fit
/**
 * Cover-fit rectangle for an image inside a panel.
 * Returns { dx, dy, dw, dh } in panel-local pixels: the image is scaled so it
 * fills the panel (zoom multiplies that scale), then centred and shifted by
 * the panel's pan offsets (fractions of the overflow, -1..1 on each axis).
 */
export function coverFit(imgW, imgH, panelW, panelH, zoom = 1, offsetX = 0, offsetY = 0) {
  const scale = Math.max(panelW / imgW, panelH / imgH) * Math.max(0.2, zoom);
  const dw = imgW * scale;
  const dh = imgH * scale;
  const spareX = dw - panelW;
  const spareY = dh - panelH;
  const dx = -spareX / 2 + offsetX * (spareX / 2);
  const dy = -spareY / 2 + offsetY * (spareY / 2);
  return { dx, dy, dw, dh };
}

function imageSize(img) {
  return {
    w: img.naturalWidth || img.videoWidth || img.width,
    h: img.naturalHeight || img.videoHeight || img.height,
  };
}

// ---------------------------------------------------------------- caption
/**
 * Split an uppercase title into stacked lines. Tries 1..3 lines and keeps
 * the grouping whose longest line is shortest, so the fitted type can run
 * as large as possible.
 */
export function splitTitle(title) {
  const words = title.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length === 1) return words;
  let best = [words.join(' ')];
  let bestScore = best[0].length;
  for (let lines = 2; lines <= Math.min(3, words.length); lines++) {
    // Split the words sequentially into `lines` near-equal groups (word
    // order is preserved), then score the grouping by its longest line.
    const seq = Array.from({ length: lines }, () => []);
    const per = Math.ceil(words.length / lines);
    words.forEach((word, i) => seq[Math.min(lines - 1, Math.floor(i / per))].push(word));
    const candidate = seq.map((g) => g.join(' ')).filter(Boolean);
    const score = Math.max(...candidate.map((l) => l.length));
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** Largest title size (px) whose widest line fits maxWidth, capped by maxSize. */
export function fitTitleSize(ctx, lines, maxWidth, maxSize) {
  let size = maxSize;
  while (size > 10) {
    ctx.font = TITLE_FONT(size);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest <= maxWidth) break;
    size -= 2;
  }
  return size;
}

// ---------------------------------------------------------------- drawing
function drawPanel(ctx, img, rect, grade, pan) {
  const [fx, fy, fw, fh] = rect;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const px = fx * W;
  const py = fy * H;
  const pw = fw * W;
  const ph = fh * H;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  if (img) {
    const { w: iw, h: ih } = imageSize(img);
    const fit = coverFit(iw, ih, pw, ph, pan.zoom, pan.offsetX, pan.offsetY);
    ctx.filter = `saturate(${grade.saturation}) contrast(${grade.contrast})`;
    ctx.drawImage(img, px + fit.dx, py + fit.dy, fit.dw, fit.dh);
    ctx.filter = 'none';
  } else {
    const blank = ctx.createLinearGradient(px, py, px + pw, py + ph);
    blank.addColorStop(0, '#241b3a');
    blank.addColorStop(1, '#0d0a1a');
    ctx.fillStyle = blank;
    ctx.fillRect(px, py, pw, ph);
  }
  ctx.restore();
  return { px, py, pw, ph };
}

function drawGradeWash(ctx, grade) {
  const { width: W, height: H } = ctx.canvas;
  const wash = ctx.createLinearGradient(0, 0, 0, H);
  for (const [pos, colour] of grade.stops) wash.addColorStop(pos, colour);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
}

function drawVignette(ctx) {
  const { width: W, height: H } = ctx.canvas;
  const shade = ctx.createLinearGradient(0, H * 0.45, 0, H);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.72)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, H * 0.45, W, H * 0.55);
}

function drawDividers(ctx, rects, grade) {
  const { width: W, height: H } = ctx.canvas;
  const ink = Math.max(4, Math.round(Math.min(W, H) * 0.012));
  ctx.strokeStyle = '#07060d';
  ctx.lineWidth = ink;
  for (const { px, py, pw, ph } of rects) ctx.strokeRect(px, py, pw, ph);
  // Outer frame, twice as heavy, so the collage reads as one poster.
  ctx.lineWidth = ink * 2;
  ctx.strokeRect(0, 0, W, H);
  // A hairline of grade accent just inside the frame ties the collage to
  // the caption's accent colour without shouting over the photos.
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = Math.max(2, ink * 0.28);
  const inset = ink + Math.max(2, ink * 0.28);
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.restore();
}

function drawCaption(ctx, title, subtitle, grade) {
  const { width: W, height: H } = ctx.canvas;
  const lines = splitTitle(title || '');
  const sub = (subtitle || '').trim().toUpperCase();
  if (lines.length === 0 && !sub) return;

  const margin = W * 0.06;
  const maxWidth = W - margin * 2;
  let titleSize = 0;
  if (lines.length > 0) {
    titleSize = fitTitleSize(ctx, lines, maxWidth, H * 0.13);
  }
  const lineHeight = titleSize * 1.04;
  const subSize = Math.max(12, Math.min(H * 0.032, titleSize * 0.32 || H * 0.032));
  const barH = Math.max(4, H * 0.008);
  const gap = H * 0.018;

  const blockH = lines.length * lineHeight + (sub ? gap + barH + gap + subSize : 0);
  let cursor = H - H * 0.055 - blockH; // baseline block anchored to the foot
  const centreX = W / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (const line of lines) {
    ctx.font = TITLE_FONT(titleSize);
    // Accent offset shadow first, then the dark outline, then the white fill.
    ctx.fillStyle = grade.accent;
    ctx.fillText(line, centreX + titleSize * 0.055, cursor + titleSize * 0.055);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0b0a14';
    ctx.lineWidth = titleSize * 0.16;
    ctx.strokeText(line, centreX, cursor);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, centreX, cursor);
    cursor += lineHeight;
  }

  if (sub) {
    cursor += gap;
    const barW = Math.min(W * 0.16, maxWidth);
    ctx.fillStyle = grade.accent;
    ctx.fillRect(centreX - barW / 2, cursor, barW, barH);
    cursor += barH + gap;
    ctx.font = SUB_FONT(subSize);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0b0a14';
    ctx.lineWidth = subSize * 0.18;
    ctx.strokeText(sub, centreX, cursor);
    ctx.fillStyle = grade.accent;
    ctx.fillText(sub, centreX, cursor);
  }
  ctx.textBaseline = 'alphabetic';
}

/**
 * Paint a complete cover onto a canvas.
 * state = {
 *   photos:   decoded images (panel i uses photos[i % photos.length]),
 *   layout:   a LAYOUTS key,
 *   grade:    a GRADES key,
 *   title:    caption headline text,
 *   subtitle: caption sub-line text,
 *   panels:   optional per-panel { offsetX, offsetY, zoom } overrides,
 *   zoom:     global zoom applied when a panel has no override,
 * }
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const layout = LAYOUTS[state.layout] || LAYOUTS.hero;
  const grade = GRADES[state.grade] || GRADES.vice;
  const photos = state.photos || [];
  const overrides = state.panels || [];

  ctx.fillStyle = '#07060d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const rects = layout.panels.map((rect, i) => {
    const pan = {
      offsetX: overrides[i]?.offsetX ?? 0,
      offsetY: overrides[i]?.offsetY ?? 0,
      zoom: overrides[i]?.zoom ?? state.zoom ?? 1,
    };
    const img = photos.length ? photos[i % photos.length] : null;
    return drawPanel(ctx, img, rect, grade, pan);
  });

  drawGradeWash(ctx, grade);
  drawVignette(ctx);
  drawDividers(ctx, rects, grade);
  drawCaption(ctx, state.title, state.subtitle, grade);
}
