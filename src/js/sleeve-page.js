import { generateSleeveNet } from '/js/sleeve/geometry.js';
import { composeThemedSleeve } from '/js/sleeve/composition.js';
import { getPaperSize, setPaperSize } from '/js/paper-preference.js';
import carousel from '/data/sleeves/donor-boxes/carousel-v1.json';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PREVIEW_TITLE_ID = 'sleeve-preview-title';

let themes = [];
let selectedThemeId = null;
let titleText = '';
let paperSize = getPaperSize();
let downloading = false;

function buildPreviewSvg() {
  const theme = themes.find(t => t.id === selectedThemeId);
  if (!theme) return null;

  try {
    const { svg, dieline } = generateSleeveNet({
      donorBox: carousel,
      paperSize,
      shaved: true,
    });

    composeThemedSleeve({ svg, dieline, theme, title: titleText });

    const titleLabel = titleText.trim()
      ? `Box sleeve preview — ${paperSize}, theme: ${theme.label}, title: "${titleText.trim()}".`
      : `Box sleeve preview — ${paperSize}, theme: ${theme.label}.`;

    const titleEl = document.createElementNS(SVG_NS, 'title');
    titleEl.setAttribute('id', PREVIEW_TITLE_ID);
    titleEl.textContent = titleLabel;

    const descEl = document.createElementNS(SVG_NS, 'desc');
    descEl.setAttribute('id', 'sleeve-preview-desc');
    descEl.textContent =
      'Flat dieline preview showing the selected theme art with cut and fold lines drawn on top.';

    svg.insertBefore(descEl, svg.firstChild);
    svg.insertBefore(titleEl, svg.firstChild);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-labelledby', PREVIEW_TITLE_ID);

    return svg;
  } catch (err) {
    console.error('Sleeve preview render failed:', err);
    return null;
  }
}

function rerender() {
  const container = document.getElementById('sleeve-preview');
  const downloadBtn = document.getElementById('sleeve-download-btn');
  if (!container) return;

  const svg = buildPreviewSvg();
  if (svg) {
    container.replaceChildren(svg);
    container.removeAttribute('aria-busy');
    delete container.dataset.state;
    if (downloadBtn) downloadBtn.disabled = false;
  } else {
    const fallback = document.createElement('p');
    fallback.className = 'rvb-prose';
    fallback.textContent = 'Preview unavailable. Please refresh the page.';
    container.replaceChildren(fallback);
    container.dataset.state = 'error';
    container.removeAttribute('aria-busy');
    if (downloadBtn) downloadBtn.disabled = true;
  }
}

function makeFileName(themeId) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `sleeve-${themeId}-${date}-${time}.pdf`;
}

async function handleDownload() {
  if (downloading) return;
  const svgEl = document.querySelector('#sleeve-preview > svg');
  if (!svgEl) return;

  const btn = document.getElementById('sleeve-download-btn');
  const statusEl = document.getElementById('sleeve-download-status');
  downloading = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Generating PDF…'; }
  if (statusEl) statusEl.textContent = '';

  try {
    const { exportSleeveAsPdf } = await import('/js/sleeve/pdf-adapter.js');
    const bytes = await exportSleeveAsPdf({ svgElement: svgEl, paperSize });
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = makeFileName(selectedThemeId ?? 'sleeve');
    a.click();
    URL.revokeObjectURL(url);
    if (statusEl) statusEl.textContent = 'PDF ready.';
  } catch (err) {
    console.error('PDF export failed:', err);
    if (statusEl) statusEl.textContent = 'Export failed — see console for details.';
  } finally {
    downloading = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Download sleeve PDF'; }
  }
}

function renderThemePicker(pickerEl) {
  pickerEl.innerHTML = '';
  for (const theme of themes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rvb-theme-tile';
    btn.dataset.themeId = theme.id;
    btn.setAttribute('aria-pressed', theme.id === selectedThemeId ? 'true' : 'false');

    const img = document.createElement('img');
    img.className = 'rvb-theme-tile__thumb';
    img.src = theme.art;
    img.alt = '';
    img.loading = 'eager';

    const label = document.createElement('span');
    label.className = 'rvb-theme-tile__label';
    label.textContent = theme.label;

    btn.appendChild(img);
    btn.appendChild(label);
    pickerEl.appendChild(btn);
  }

  pickerEl.addEventListener('click', e => {
    const btn = e.target.closest('.rvb-theme-tile');
    if (!btn) return;
    const id = btn.dataset.themeId;
    if (id === selectedThemeId) return;
    selectedThemeId = id;
    for (const tile of pickerEl.querySelectorAll('.rvb-theme-tile')) {
      tile.setAttribute('aria-pressed', tile.dataset.themeId === selectedThemeId ? 'true' : 'false');
    }
    rerender();
  });
}

async function init() {
  const pickerEl = document.getElementById('theme-picker');
  const titleInputEl = document.getElementById('sleeve-title');
  const container = document.getElementById('sleeve-preview');
  const paperToggleEl = document.querySelector('.rvb-sleeve-paper-toggle__buttons');
  if (!pickerEl || !titleInputEl || !container) return;

  try {
    const resp = await fetch('/sleeves/themes/themes.json');
    if (!resp.ok) throw new Error(`Failed to fetch themes.json: ${resp.status}`);
    const doc = await resp.json();
    if (!Array.isArray(doc.themes) || doc.themes.length === 0) {
      throw new Error('Theme catalogue is empty.');
    }
    themes = doc.themes.filter(t => t.status !== 'deprecated');
    if (themes.length === 0) {
      throw new Error('Theme catalogue contains no active themes.');
    }
    selectedThemeId = themes[0].id;
  } catch (err) {
    console.error('Theme catalogue load failed:', err);
    const fallback = document.createElement('p');
    fallback.className = 'rvb-prose';
    fallback.textContent = 'Could not load theme catalogue. Please refresh the page.';
    container.replaceChildren(fallback);
    container.dataset.state = 'error';
    container.removeAttribute('aria-busy');
    return;
  }

  renderThemePicker(pickerEl);

  titleInputEl.addEventListener('input', e => {
    titleText = e.target.value;
    rerender();
  });

  if (paperToggleEl) {
    // Sync buttons to the loaded preference before wiring the click handler.
    for (const b of paperToggleEl.querySelectorAll('.rvb-paper-btn')) {
      b.setAttribute('aria-pressed', b.dataset.paper === paperSize ? 'true' : 'false');
    }

    paperToggleEl.addEventListener('click', e => {
      const btn = e.target.closest('.rvb-paper-btn');
      if (!btn) return;
      const size = btn.dataset.paper;
      if (size === paperSize) return;
      paperSize = size;
      setPaperSize(size);
      for (const b of paperToggleEl.querySelectorAll('.rvb-paper-btn')) {
        b.setAttribute('aria-pressed', b.dataset.paper === paperSize ? 'true' : 'false');
      }
      rerender();
    });
  }

  const downloadBtn = document.getElementById('sleeve-download-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', handleDownload);
  }

  rerender();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
