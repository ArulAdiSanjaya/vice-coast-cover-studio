// Vice Coast Cover Studio — editor wiring.
//
// Owns the editor state, loads photos from local files or the bundled
// samples (object URLs / relative paths only — nothing is uploaded), wires
// every control on the page, keeps the preview painted, and exports a PNG
// at the chosen size by re-rendering the cover on an offscreen canvas.
import { drawCover, LAYOUTS, LAYOUT_ORDER, GRADES, GRADE_ORDER } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('stage');
const status = document.getElementById('status');
const titleInput = document.getElementById('title-input');
const subtitleInput = document.getElementById('subtitle-input');
const zoomSlider = document.getElementById('zoom-slider');
const zoomValue = document.getElementById('zoom-value');
const sizePicker = document.getElementById('size-picker');
const panelChips = document.getElementById('panel-chips');

const state = {
  photos: [],
  layout: 'hero',
  grade: 'vice',
  title: titleInput.value,
  subtitle: subtitleInput.value,
  panels: [], // per-panel { offsetX, offsetY, zoom } overrides
  selectedPanel: 0,
};

/** The export size currently chosen, as [width, height]. */
function exportSize() {
  const [w, h] = sizePicker.value.split('x').map(Number);
  return [w || 1080, h || 1080];
}

function render() {
  drawCover(canvas, state);
}

function say(message) {
  status.textContent = message;
}

/** Load an image from a URL; resolves once it is drawable. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function addPhotoUrls(urls) {
  for (const url of urls) state.photos.push(await loadImage(url));
  refreshPanelChips();
  render();
}

function panelCount() {
  return LAYOUTS[state.layout].panels.length;
}

function ensurePanelState() {
  while (state.panels.length < panelCount()) {
    state.panels.push({ offsetX: 0, offsetY: 0, zoom: Number(zoomSlider.value) });
  }
  if (state.selectedPanel >= panelCount()) state.selectedPanel = 0;
}

function refreshPanelChips() {
  ensurePanelState();
  panelChips.replaceChildren();
  for (let i = 0; i < panelCount(); i++) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = `Panel ${i + 1}`;
    chip.setAttribute('aria-pressed', String(i === state.selectedPanel));
    chip.addEventListener('click', () => {
      state.selectedPanel = i;
      zoomSlider.value = state.panels[i].zoom;
      zoomValue.textContent = `${state.panels[i].zoom.toFixed(2)}×`;
      refreshPanelChips();
    });
    panelChips.append(chip);
  }
}

function buildPicker(el, order, defs, current, onPick) {
  for (const key of order) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = defs[key].label;
    chip.dataset.key = key;
    chip.setAttribute('aria-pressed', String(key === current));
    chip.addEventListener('click', () => {
      onPick(key);
      for (const other of el.children) {
        other.setAttribute('aria-pressed', String(other.dataset.key === key));
      }
    });
    el.append(chip);
  }
}

// ---------------------------------------------------------------- controls
document.getElementById('photo-input').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (files.length === 0) return;
  await addPhotoUrls(files.map((f) => URL.createObjectURL(f)));
  say(`Added ${files.length} photo${files.length === 1 ? '' : 's'} — ${state.photos.length} in the cover.`);
  e.target.value = '';
});

document.getElementById('sample-boulevard').addEventListener('click', async () => {
  await addPhotoUrls(['samples/boulevard.jpg']);
  say('Added the Boulevard sample photo.');
});
document.getElementById('sample-pier').addEventListener('click', async () => {
  await addPhotoUrls(['samples/pier.jpg']);
  say('Added the Pier sample photo.');
});

titleInput.addEventListener('input', () => { state.title = titleInput.value; render(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; render(); });

buildPicker(document.getElementById('layout-picker'), LAYOUT_ORDER, LAYOUTS, state.layout, (key) => {
  state.layout = key;
  refreshPanelChips();
  render();
});
buildPicker(document.getElementById('grade-picker'), GRADE_ORDER, GRADES, state.grade, (key) => {
  state.grade = key;
  render();
});

sizePicker.addEventListener('change', () => {
  const [w, h] = exportSize();
  canvas.width = w;
  canvas.height = h;
  render();
});

zoomSlider.addEventListener('input', () => {
  ensurePanelState();
  const zoom = Number(zoomSlider.value);
  state.panels[state.selectedPanel].zoom = zoom;
  zoomValue.textContent = `${zoom.toFixed(2)}×`;
  render();
});

// Drag on the canvas pans the selected panel: the offset is stored as a
// fraction of the panel's cover-fit overflow (see cover.js coverFit), so a
// drag of half the panel maps to the full pan range.
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  ensurePanelState();
  drag = { x: e.clientX, y: e.clientY, panel: state.panels[state.selectedPanel] };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const dx = (e.clientX - drag.x) / rect.width;
  const dy = (e.clientY - drag.y) / rect.height;
  drag.x = e.clientX;
  drag.y = e.clientY;
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  drag.panel.offsetX = clamp(drag.panel.offsetX - dx * 2);
  drag.panel.offsetY = clamp(drag.panel.offsetY - dy * 2);
  render();
});
const endDrag = () => { drag = null; canvas.classList.remove('dragging'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

document.getElementById('export-btn').addEventListener('click', () => {
  const [w, h] = exportSize();
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, state);
  off.toBlob((blob) => {
    if (!blob) { say('Export failed in this browser.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-coast-cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    say(`Saved vice-coast-cover-${w}x${h}.png`);
  }, 'image/png');
});

// ---------------------------------------------------------------- scenes
const params = new URLSearchParams(location.search);
if (params.get('shot')) {
  runShot(params, {
    canvas,
    state,
    loadImage,
    applyAndRender(patch) {
      Object.assign(state, patch);
      if (patch.title !== undefined) titleInput.value = patch.title;
      if (patch.subtitle !== undefined) subtitleInput.value = patch.subtitle;
      refreshPanelChips();
      render();
    },
  });
} else {
  refreshPanelChips();
  render();
}
