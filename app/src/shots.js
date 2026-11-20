// Fixed scenes for screenshots, driven by the ?shot= query.
//
//   ?shot=cover   full-bleed cover at the window size. Query params:
//                 photo (sample name, repeatable as photo2 for a second
//                 sample), layout, grade, title, subtitle.
//   ?shot=editor  the editor page with a sample photo already loaded;
//                 photo, title and subtitle params apply the same way.
//
// Scenes only ever load the bundled samples — the same local files the
// editor itself uses. window.__shotReady is set once the scene is painted,
// so a screenshot driver can wait for it.

const SAMPLES = {
  boulevard: 'samples/boulevard.jpg',
  pier: 'samples/pier.jpg',
};

function sampleUrl(name) {
  return SAMPLES[name] || SAMPLES.pier;
}

async function loadPhotos(params, loadImage) {
  const photos = [await loadImage(sampleUrl(params.get('photo')))];
  if (params.get('photo2')) photos.push(await loadImage(sampleUrl(params.get('photo2'))));
  return photos;
}

export async function runShot(params, stage) {
  const shot = params.get('shot');
  const photos = await loadPhotos(params, stage.loadImage);
  const patch = {
    photos,
    title: params.get('title') ?? stage.state.title,
    subtitle: params.get('subtitle') ?? stage.state.subtitle,
  };
  if (params.get('layout')) patch.layout = params.get('layout');
  if (params.get('grade')) patch.grade = params.get('grade');

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    // The canvas becomes the whole window, so the render is a clean export.
    stage.canvas.width = window.innerWidth;
    stage.canvas.height = window.innerHeight;
  } else if (shot === 'editor') {
    document.body.classList.add('shot-editor');
  }

  stage.applyAndRender(patch);
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
