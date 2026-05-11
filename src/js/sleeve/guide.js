/**
 * Assembly guide layer for the Ravenswood Bluff box sleeve generator.
 *
 * Renders a six-step visual assembly guide in a dedicated strip below the
 * dieline net. The guide occupies the offcut area — below the cut line —
 * and is discarded when the sleeve is cut from the sheet.
 *
 * Public API:
 *   composeAssemblyGuide(svg, dieline)
 *     Extends the SVG canvas by GUIDE_HEIGHT_MM, sets data-guide-height-mm
 *     on the SVG element (read by pdf-adapter to extend the PDF page), and
 *     renders six numbered step thumbnails.
 *
 * Module rules: no pdf-lib import; no geometry.js import.
 * Receives `dieline` from generateSleeveNet — reads dieline.viewBox only.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const GUIDE_HEIGHT_MM = 55;
const GUIDE_STEPS = 6;
const GUIDE_CELL_PADDING_MM = 4;
const NUMBER_AREA_H_MM = 11;
const NUMBER_FONT_MM = 8;

const COLOUR_SEPARATOR = '#b3b3b3';
const COLOUR_DIVIDER = '#dddddd';
const COLOUR_ICON = '#222222';
const COLOUR_ICON_LIGHT = '#888888';
const COLOUR_ICON_FILL_LIGHT = '#e0e0e0';
const COLOUR_ICON_FILL_BOX = '#f5f5f5';
const COLOUR_NUMBER = '#444444';
const ICON_STROKE_W = 1.2;

// ── SVG element helpers ────────────────────────────────────────────────────

function svgEl(tag, attrs) {
  const e = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  }
  return e;
}

function applyStroke(e, {
  stroke = COLOUR_ICON,
  strokeWidth = ICON_STROKE_W,
  fill = 'none',
} = {}) {
  e.setAttribute('stroke', stroke);
  e.setAttribute('stroke-width', String(strokeWidth));
  e.setAttribute('fill', fill);
  e.setAttribute('stroke-linecap', 'round');
  e.setAttribute('stroke-linejoin', 'round');
  return e;
}

function seg(x1, y1, x2, y2, opts) {
  return applyStroke(svgEl('line', { x1, y1, x2, y2 }), opts);
}

function circ(cx, cy, r, opts) {
  return applyStroke(svgEl('circle', { cx, cy, r }), opts);
}

function pth(d, opts) {
  return applyStroke(svgEl('path', { d }), opts);
}

function rct(x, y, w, h, opts) {
  return applyStroke(svgEl('rect', { x, y, width: w, height: h }), opts);
}

// Filled arrowheads — stroke-width 0 so only the fill shows.
function arrowDown(ax, ay, sz) {
  const d = `M ${ax - sz},${ay - sz} L ${ax},${ay} L ${ax + sz},${ay - sz} Z`;
  return pth(d, { fill: COLOUR_ICON, strokeWidth: 0 });
}

function arrowUp(ax, ay, sz) {
  const d = `M ${ax - sz},${ay + sz} L ${ax},${ay} L ${ax + sz},${ay + sz} Z`;
  return pth(d, { fill: COLOUR_ICON, strokeWidth: 0 });
}

function arrowRight(ax, ay, sz) {
  const d = `M ${ax - sz},${ay - sz} L ${ax},${ay} L ${ax - sz},${ay + sz} Z`;
  return pth(d, { fill: COLOUR_ICON, strokeWidth: 0 });
}

// ── Icon functions ─────────────────────────────────────────────────────────
// Each receives (g, ix, iy, iw, ih): group to append to, icon-area origin
// and dimensions in SVG viewBox coordinates (mm). All coordinates are
// computed as normalised fractions 0–1 scaled to iw × ih.

function drawIconCut(g, ix, iy, iw, ih) {
  const X = t => ix + t * iw;
  const Y = t => iy + t * ih;
  const sz  = 0.07 * Math.min(iw, ih);
  const rng = 0.14 * Math.min(iw, ih);

  // Blades
  g.appendChild(seg(X(0.5), Y(0.45), X(0.15), Y(0.10)));
  g.appendChild(seg(X(0.5), Y(0.45), X(0.85), Y(0.10)));
  // Handle stems
  g.appendChild(seg(X(0.5), Y(0.45), X(0.26), Y(0.65)));
  g.appendChild(seg(X(0.5), Y(0.45), X(0.74), Y(0.65)));
  // Handle rings
  g.appendChild(circ(X(0.20), Y(0.82), rng));
  g.appendChild(circ(X(0.80), Y(0.82), rng));
  // Pivot dot (filled)
  g.appendChild(circ(X(0.5), Y(0.45), sz, { fill: COLOUR_ICON }));
  // Dashed cut-line indicator
  const cl = seg(X(0.05), Y(0.97), X(0.95), Y(0.97),
    { stroke: COLOUR_SEPARATOR, strokeWidth: 0.7 });
  cl.setAttribute('stroke-dasharray', '2 1.5');
  g.appendChild(cl);
}

function drawIconScore(g, ix, iy, iw, ih) {
  const X = t => ix + t * iw;
  const Y = t => iy + t * ih;

  // Tool body
  g.appendChild(rct(X(0.05), Y(0.10), X(0.70) - X(0.05), Y(0.30) - Y(0.10),
    { fill: COLOUR_ICON_FILL_LIGHT, stroke: '#444444' }));
  // Tool tip (right-pointing triangle)
  g.appendChild(pth(
    `M ${X(0.70)},${Y(0.10)} L ${X(0.95)},${Y(0.20)} L ${X(0.70)},${Y(0.30)} Z`,
    { fill: COLOUR_ICON_LIGHT, stroke: COLOUR_ICON_LIGHT }));

  // Downward arrows (tool pressing on fold)
  const ay = Y(0.52);
  g.appendChild(seg(X(0.25), Y(0.35), X(0.25), ay));
  g.appendChild(arrowDown(X(0.25), ay, 1.5));
  g.appendChild(seg(X(0.60), Y(0.35), X(0.60), ay));
  g.appendChild(arrowDown(X(0.60), ay, 1.5));

  // Score line (dashed)
  const sl = seg(X(0.05), Y(0.62), X(0.95), Y(0.62),
    { stroke: COLOUR_SEPARATOR, strokeWidth: 0.7 });
  sl.setAttribute('stroke-dasharray', '2.5 1.5');
  g.appendChild(sl);
}

function drawIconFoldValley(g, ix, iy, iw, ih) {
  const X = t => ix + t * iw;
  const Y = t => iy + t * ih;

  // V cross-section
  g.appendChild(pth(
    `M ${X(0.05)},${Y(0.35)} L ${X(0.38)},${Y(0.35)} ` +
    `L ${X(0.50)},${Y(0.78)} L ${X(0.62)},${Y(0.35)} L ${X(0.95)},${Y(0.35)}`));

  // Downward arrows at fold points (fold toward viewer)
  g.appendChild(seg(X(0.38), Y(0.12), X(0.38), Y(0.30)));
  g.appendChild(arrowDown(X(0.38), Y(0.30), 1.5));
  g.appendChild(seg(X(0.62), Y(0.12), X(0.62), Y(0.30)));
  g.appendChild(arrowDown(X(0.62), Y(0.30), 1.5));

  // Arrowhead at apex reinforcing fold direction
  g.appendChild(arrowDown(X(0.50), Y(0.84), 2));
}

function drawIconFoldMountain(g, ix, iy, iw, ih) {
  const X = t => ix + t * iw;
  const Y = t => iy + t * ih;

  // Λ cross-section
  g.appendChild(pth(
    `M ${X(0.05)},${Y(0.65)} L ${X(0.38)},${Y(0.65)} ` +
    `L ${X(0.50)},${Y(0.22)} L ${X(0.62)},${Y(0.65)} L ${X(0.95)},${Y(0.65)}`));

  // Upward arrows at fold points (fold away from viewer)
  g.appendChild(seg(X(0.38), Y(0.88), X(0.38), Y(0.70)));
  g.appendChild(arrowUp(X(0.38), Y(0.70), 1.5));
  g.appendChild(seg(X(0.62), Y(0.88), X(0.62), Y(0.70)));
  g.appendChild(arrowUp(X(0.62), Y(0.70), 1.5));

  // Arrowhead at apex reinforcing fold direction
  g.appendChild(arrowUp(X(0.50), Y(0.16), 2));
}

function drawIconGlue(g, ix, iy, iw, ih) {
  const X = t => ix + t * iw;
  const Y = t => iy + t * ih;

  // Tab rectangle
  g.appendChild(rct(X(0.15), Y(0.30), X(0.85) - X(0.15), Y(0.68) - Y(0.30)));

  // Diagonal hatching (adhesive)
  const hs = { stroke: COLOUR_ICON_LIGHT, strokeWidth: 0.7 };
  g.appendChild(seg(X(0.15), Y(0.45), X(0.30), Y(0.30), hs));
  g.appendChild(seg(X(0.15), Y(0.68), X(0.53), Y(0.30), hs));
  g.appendChild(seg(X(0.40), Y(0.68), X(0.85), Y(0.30), hs));

  // Press arrows
  g.appendChild(seg(X(0.38), Y(0.08), X(0.38), Y(0.27)));
  g.appendChild(arrowDown(X(0.38), Y(0.27), 1.5));
  g.appendChild(seg(X(0.62), Y(0.92), X(0.62), Y(0.73)));
  g.appendChild(arrowUp(X(0.62), Y(0.73), 1.5));
}

function drawIconSlide(g, ix, iy, iw, ih) {
  const X = t => ix + t * iw;
  const Y = t => iy + t * ih;

  // Box end face (the TPI box)
  g.appendChild(rct(X(0.30), Y(0.25), X(0.70) - X(0.30), Y(0.75) - Y(0.25),
    { fill: COLOUR_ICON_FILL_BOX, stroke: '#444444' }));

  // Left sleeve bracket (open C-shape)
  g.appendChild(seg(X(0.10), Y(0.25), X(0.10), Y(0.75)));
  g.appendChild(seg(X(0.10), Y(0.25), X(0.30), Y(0.25)));
  g.appendChild(seg(X(0.10), Y(0.75), X(0.30), Y(0.75)));

  // Right sleeve bracket
  g.appendChild(seg(X(0.90), Y(0.25), X(0.90), Y(0.75)));
  g.appendChild(seg(X(0.70), Y(0.25), X(0.90), Y(0.25)));
  g.appendChild(seg(X(0.70), Y(0.75), X(0.90), Y(0.75)));

  // Direction arrow (box sliding into sleeve from left)
  g.appendChild(seg(X(0.10), Y(0.50), X(0.27), Y(0.50)));
  g.appendChild(arrowRight(X(0.27), Y(0.50), 1.5));
}

const STEP_ICON_FNS = [
  drawIconCut,
  drawIconScore,
  drawIconFoldValley,
  drawIconFoldMountain,
  drawIconGlue,
  drawIconSlide,
];

// ── Public API ─────────────────────────────────────────────────────────────

export function composeAssemblyGuide(svg, dieline) {
  const netH = dieline.viewBox.height;
  const vbW  = dieline.viewBox.width;
  const newH = netH + GUIDE_HEIGHT_MM;

  // Extend SVG canvas to include the guide strip.
  svg.setAttribute('viewBox', `0 0 ${vbW} ${newH}`);
  svg.setAttribute('height', `${newH}mm`);
  // pdf-adapter reads this to extend the PDF page height and reposition the net.
  svg.setAttribute('data-guide-height-mm', String(GUIDE_HEIGHT_MM));

  const g = svgEl('g');
  g.setAttribute('data-layer', 'assembly-guide');

  // Separator between net bleed-bottom and guide strip.
  const sep = seg(0, netH, vbW, netH,
    { stroke: COLOUR_SEPARATOR, strokeWidth: 0.25 });
  sep.setAttribute('stroke-dasharray', '2 2');
  g.appendChild(sep);

  const cellW = vbW / GUIDE_STEPS;
  const cellH = GUIDE_HEIGHT_MM;

  for (let i = 0; i < GUIDE_STEPS; i++) {
    const cX = i * cellW;
    const cY = netH;

    // Vertical divider between cells.
    if (i > 0) {
      g.appendChild(seg(cX, cY, cX, cY + cellH,
        { stroke: COLOUR_DIVIDER, strokeWidth: 0.25 }));
    }

    // Step numeral.
    const num = svgEl('text');
    num.setAttribute('x', String(cX + cellW / 2));
    num.setAttribute('y', String(cY + GUIDE_CELL_PADDING_MM + NUMBER_FONT_MM));
    num.setAttribute('text-anchor', 'middle');
    num.setAttribute('font-family', "'Cinzel', serif");
    num.setAttribute('font-size', String(NUMBER_FONT_MM));
    num.setAttribute('fill', COLOUR_NUMBER);
    num.setAttribute('data-role', 'guide-step-number');
    num.textContent = String(i + 1);
    g.appendChild(num);

    // Icon area (below the numeral).
    const iX = cX + GUIDE_CELL_PADDING_MM;
    const iY = cY + NUMBER_AREA_H_MM;
    const iW = cellW - 2 * GUIDE_CELL_PADDING_MM;
    const iH = cellH - NUMBER_AREA_H_MM - GUIDE_CELL_PADDING_MM;
    STEP_ICON_FNS[i](g, iX, iY, iW, iH);
  }

  svg.appendChild(g);
}
