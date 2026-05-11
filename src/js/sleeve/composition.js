/**
 * Themed-sleeve art composition layer.
 *
 * Takes a dieline + base SVG produced by generateSleeveNet (Story 1.1) and a
 * theme entry from public/sleeves/themes/themes.json, and layers theme art
 * into the SVG. Mutates the SVG in place: inserts a <defs><clipPath/></defs>
 * carrying the bleed-extended cut perimeter, and an <g data-layer="art">
 * group BEFORE the existing <g data-layer="dieline"> group so the cut and
 * fold lines render on top of the art.
 *
 * Strict separation from geometry: this module imports nothing from
 * geometry.js; it consumes only the dieline metadata that geometry exposes.
 * No PDF library is imported (Story 1.6's territory).
 *
 * Public API:
 *   composeThemedSleeve({ svg, dieline, theme })
 *     - svg: the SVGSVGElement returned by generateSleeveNet
 *     - dieline: the dieline metadata returned by generateSleeveNet
 *     - theme: a theme object loaded from themes.json
 *
 *   Returns: { svg } (the same SVG element, mutated in place).
 *
 * Throws:
 *   - if dieline.shaved !== true
 *     (the unshaved A4 variant is geometry-only in v1; no theme art is
 *     authored for it because the production default ships shaved on both
 *     A4 and Letter for symmetric bare-end reveal).
 *   - if theme.designedFor.shaved !== true
 *     (theme not authored for the production-default shaved geometry).
 *   - if theme.artDimensionsMm differs from dieline.viewBox by > 0.01mm
 *     (prevents silent stretching when paper-size toggling lands in
 *     Story 1.5: a Letter-only theme being composed onto an A4-unshaved
 *     dieline would otherwise distort horizontally).
 */

import { composeAssemblyGuide } from './guide.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DIM_TOLERANCE_MM = 0.01;
const THEME_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

const PROVENANCE_MARK = [
  'Custom sleeve from ravenswoodbluff.com — fits the official Carousel box from The Pandemonium Institute.',
  'Designed by Angelus Morningstar (also the creator of Invictus).',
];
const PROVENANCE_FONT_SIZE_MM = 2.5;
const PROVENANCE_LINE_SPACING_MM = 3;

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * Build the bleed-extended cut perimeter polygon in viewBox coordinates.
 *
 * The geometry layer draws the cut perimeter at the trim rectangle (offset
 * by bleedMm inside the viewBox), with a 45-degree chamfer in the lower-right
 * corner of the glue tab. The bleed-extended perimeter offsets that path
 * outward by bleedMm on every edge so theme art can fill the bleed zone
 * without printing past where scissors will cut.
 *
 * In viewBox space, the rectangular edges offset to the viewBox bounding box
 * exactly (top edge to y=0, right edge to x=viewBox.width, etc.). The chamfer
 * offsets perpendicular to its 45-degree line, which moves each axis by
 * bleedMm / sqrt(2). The offset chamfer line, extended to meet the viewBox
 * right and bottom edges, gives the two chamfer-corner vertices.
 *
 * For carousel-v1 (b=5, c=5), the chamfer-corner vertices sit inside the
 * viewBox (right edge at y ≈ trimH - c + b*sqrt(2), bottom edge at
 * x ≈ trimW - c + b*sqrt(2)). The polygon is genuinely chamfered, not a plain
 * rectangle.
 *
 * Returns an array of [x, y] points in viewBox space, suitable for emission
 * as an SVG <polygon points="..."/>.
 */
function buildBleedExtendedPolygon(dieline) {
  const b = dieline.bleedMm;
  const c = dieline.glueTabChamferMm;
  const w = dieline.viewBox.width;
  const h = dieline.viewBox.height;
  const trimW = dieline.trim.width;
  const trimH = dieline.trim.height;

  if (dieline.glueTabChamferCorner !== 'bottom-right') {
    throw new Error(
      `composeThemedSleeve: unsupported glueTabChamferCorner "${dieline.glueTabChamferCorner}". ` +
      `Only "bottom-right" is implemented; extending to other corners requires updating the polygon math.`
    );
  }

  // Offset chamfer line meets the viewBox right edge at:
  //   y = trimH - c + b * sqrt(2)
  // and the viewBox bottom edge at:
  //   x = trimW - c + b * sqrt(2)
  // Derivation: the chamfer line has slope -1 and is offset perpendicular
  // (along (+1, +1)/sqrt(2)) by b, which adds b*sqrt(2)/2 to both axes.
  // The extended offset line, extrapolated back to the viewBox right and
  // bottom edges, picks up an extra b*sqrt(2)/2 on each axis (total
  // b*sqrt(2) along whichever axis is being solved for).
  const sqrt2 = Math.SQRT2;
  const chamferRightY = trimH - c + b * sqrt2;
  const chamferBottomX = trimW - c + b * sqrt2;

  // Sanity: if the offset chamfer overshoots the viewBox, clip back to the
  // viewBox corner. This happens if a future donor box uses a chamfer larger
  // than ~b*sqrt(2). For carousel-v1 (b=c=5), it does not happen, but the
  // clamp is cheap and keeps the polygon valid for arbitrary future numbers.
  const cornerY = Math.min(Math.max(chamferRightY, 0), h);
  const cornerX = Math.min(Math.max(chamferBottomX, 0), w);

  return [
    [0, 0],
    [w, 0],
    [w, cornerY],
    [cornerX, h],
    [0, h],
  ];
}

function buildTrimPolygon(dieline) {
  const b = dieline.bleedMm;
  const c = dieline.glueTabChamferMm;
  const trimW = dieline.trim.width;
  const trimH = dieline.trim.height;

  if (dieline.glueTabChamferCorner !== 'bottom-right') {
    throw new Error(
      `buildTrimPolygon: unsupported glueTabChamferCorner "${dieline.glueTabChamferCorner}".`
    );
  }

  return [
    [b,          b],
    [b + trimW,  b],
    [b + trimW,  b + trimH - c],
    [b + trimW - c, b + trimH],
    [b,          b + trimH],
  ];
}

function pointsAttr(points) {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

function assertShavedDieline(dieline) {
  if (dieline.shaved !== true) {
    throw new Error(
      'composeThemedSleeve: requires a shaved dieline. ' +
      'The unshaved A4 variant is geometry-only in v1 and has no theme art. ' +
      'Call generateSleeveNet({ ..., shaved: true }) before composing.'
    );
  }
}

function assertThemeShaved(theme) {
  if (!theme || !theme.designedFor || theme.designedFor.shaved !== true) {
    throw new Error(
      `composeThemedSleeve: theme "${theme && theme.id}" is not designedFor a shaved dieline ` +
      `(designedFor.shaved must be true). The production default ships shaved on both ` +
      `A4 and Letter; themes must be authored against that geometry in v1.`
    );
  }
}

function assertArtDimensionsMatch(theme, dieline) {
  const want = theme.artDimensionsMm;
  const got = dieline.viewBox;
  const wantWellFormed = want && isFiniteNumber(want.width) && isFiniteNumber(want.height);
  if (
    !wantWellFormed ||
    Math.abs(want.width - got.width) > DIM_TOLERANCE_MM ||
    Math.abs(want.height - got.height) > DIM_TOLERANCE_MM
  ) {
    throw new Error(
      `composeThemedSleeve: theme "${theme.id}" was authored at ` +
      `${wantWellFormed ? `${want.width}x${want.height}mm` : '(missing or non-finite artDimensionsMm)'} ` +
      `but the dieline viewBox is ${got.width}x${got.height}mm. ` +
      `Use a matching dieline (e.g. paperSize "${theme.designedFor.paperSize}", shaved: true) ` +
      `or author a separate theme for this dieline.`
    );
  }
}

function assertThemeIdentity(theme) {
  if (!theme) {
    throw new Error('composeThemedSleeve: theme is required.');
  }
  if (typeof theme.id !== 'string' || !THEME_ID_PATTERN.test(theme.id)) {
    throw new Error(
      `composeThemedSleeve: theme.id must be a kebab-case slug matching ${THEME_ID_PATTERN}; ` +
      `got ${JSON.stringify(theme.id)}. theme.id is interpolated into an SVG element id and a ` +
      `url(#...) FuncIRI; characters outside [a-z0-9-] break clipping silently.`
    );
  }
  if (typeof theme.art !== 'string' || theme.art.length === 0) {
    throw new Error(
      `composeThemedSleeve: theme.art must be a non-empty string path; got ${JSON.stringify(theme.art)}.`
    );
  }
}

function assertDielineFinite(dieline) {
  const fields = [
    ['bleedMm', dieline.bleedMm],
    ['glueTabChamferMm', dieline.glueTabChamferMm],
    ['viewBox.width', dieline.viewBox && dieline.viewBox.width],
    ['viewBox.height', dieline.viewBox && dieline.viewBox.height],
    ['trim.width', dieline.trim && dieline.trim.width],
    ['trim.height', dieline.trim && dieline.trim.height],
  ];
  for (const [name, value] of fields) {
    if (!isFiniteNumber(value)) {
      throw new Error(
        `composeThemedSleeve: dieline.${name} must be a finite number; got ${value}. ` +
        `Was this dieline produced by generateSleeveNet?`
      );
    }
  }
}

function findOrCreateDefs(svg) {
  let defs = svg.querySelector(':scope > defs');
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  return defs;
}

function clipIdFor(theme) {
  return `sleeve-clip-${theme.id}`;
}

/**
 * Renders optional title text centred on the front face panel.
 * Appended on top of both the art layer and the dieline so it is always
 * legible regardless of where the dieline lines fall.
 */
const TITLE_FONTS = {
  ornate: "'Gothicus', serif",
  plain:  "'MedievalSharp', serif",
};

function composeTitleLayer(svg, dieline, title, titleMode = 'ornate', spineColor = '#1a0e05', titleStartX = null) {
  const front = dieline.panels.front;
  const b = dieline.bleedMm;
  const cx = b + front.x + front.width / 2;
  const cy = b + front.y + front.height / 2;
  const fontFamily = TITLE_FONTS[titleMode] ?? TITLE_FONTS.ornate;
  const tx = titleStartX ?? cx;
  const textAnchor = titleStartX !== null ? 'start' : 'middle';

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('data-layer', 'title');
  g.setAttribute('data-role', 'composition-title');

  if (titleMode === 'ornate') {
    // Replicate the character sheet's background-clip:text grunge+spine-colour effect
    // in SVG using a <clipPath> shaped to the text + overlaid grunge image.
    const clipId = 'sleeve-title-clip';
    const defs = findOrCreateDefs(svg);

    const clipPath = document.createElementNS(SVG_NS, 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipText = document.createElementNS(SVG_NS, 'text');
    clipText.setAttribute('x', String(tx));
    clipText.setAttribute('y', String(cy));
    clipText.setAttribute('text-anchor', textAnchor);
    clipText.setAttribute('dominant-baseline', 'middle');
    clipText.setAttribute('font-family', fontFamily);
    clipText.setAttribute('font-size', '16');
    clipText.setAttribute('font-weight', '400');
    clipText.textContent = title;
    clipPath.appendChild(clipText);
    defs.appendChild(clipPath);

    // Solid spine-colour fill, clipped to text shape
    const fillRect = document.createElementNS(SVG_NS, 'rect');
    fillRect.setAttribute('x', String(b + front.x));
    fillRect.setAttribute('y', String(b + front.y));
    fillRect.setAttribute('width', String(front.width));
    fillRect.setAttribute('height', String(front.height));
    fillRect.setAttribute('fill', spineColor);
    fillRect.setAttribute('clip-path', `url(#${clipId})`);

    // Grunge overlay clipped to same text shape
    const grungeImg = document.createElementNS(SVG_NS, 'image');
    grungeImg.setAttribute('href', '/images/grunge.png');
    grungeImg.setAttribute('x', String(b + front.x));
    grungeImg.setAttribute('y', String(b + front.y));
    grungeImg.setAttribute('width', String(front.width));
    grungeImg.setAttribute('height', String(front.height));
    grungeImg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    grungeImg.setAttribute('clip-path', `url(#${clipId})`);
    grungeImg.style.mixBlendMode = 'overlay';

    g.appendChild(fillRect);
    g.appendChild(grungeImg);
    g.style.filter = 'drop-shadow(0 0.4mm 0.8mm rgba(0,0,0,0.45))';
  } else {
    // Plain mode: dark solid text, matching the character sheet's #1a0e05 colour
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', String(tx));
    text.setAttribute('y', String(cy));
    text.setAttribute('text-anchor', textAnchor);
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-family', fontFamily);
    text.setAttribute('font-size', '16');
    text.setAttribute('font-weight', '400');
    text.setAttribute('fill', '#1a0e05');
    text.textContent = title;
    g.style.filter = 'drop-shadow(0 0.4mm 0.8mm rgba(0,0,0,0.45))';
    g.appendChild(text);
  }

  svg.appendChild(g);
}

function composeProvenanceMark(svg, dieline) {
  const glueTab = dieline.panels.glueTab;
  const b = dieline.bleedMm;
  const cx = b + glueTab.x + glueTab.width / 2;
  const cy = b + glueTab.y + glueTab.height / 2;

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('data-layer', 'provenance');

  for (let i = 0; i < PROVENANCE_MARK.length; i++) {
    const text = document.createElementNS(SVG_NS, 'text');
    const y = cy + (i - (PROVENANCE_MARK.length - 1) / 2) * PROVENANCE_LINE_SPACING_MM;
    text.setAttribute('x', String(cx));
    text.setAttribute('y', String(y));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-family', "'Cinzel', serif");
    text.setAttribute('font-size', String(PROVENANCE_FONT_SIZE_MM));
    text.setAttribute('fill', '#1a0e05');
    text.setAttribute('data-role', 'provenance-mark');
    text.textContent = PROVENANCE_MARK[i];
    g.appendChild(text);
  }

  svg.appendChild(g);
}

/**
 * Public entry point. See module-level docblock.
 */
export function composeThemedSleeve({ svg, dieline, theme, title = '', titleMode = 'ornate', spineColor = '#1a0e05', brocadeFile = 'navy-blue.png', logoHref = '' }) {
  // Validation gates (AC8, AC9, plus contract-boundary hardening).
  assertShavedDieline(dieline);
  assertThemeShaved(theme);
  assertThemeIdentity(theme);
  assertDielineFinite(dieline);
  // front-centre themes use their own natural dimensions; skip the viewBox match.
  if (theme.placement !== 'front-centre') assertArtDimensionsMatch(theme, dieline);

  const clipId = clipIdFor(theme);
  if (svg.querySelector(`#${CSS.escape(clipId)}`)) {
    throw new Error(
      `composeThemedSleeve: an element with id "${clipId}" already exists in this SVG. ` +
      `Compose ran twice, or theme.id collides with an existing element.`
    );
  }

  // Locate the dieline group BEFORE mutating the SVG so a malformed input
  // doesn't leave a half-mutated tree (orphan <defs>/<clipPath>) behind.
  const dielineGroup = svg.querySelector('[data-layer="dieline"]');
  if (!dielineGroup) {
    throw new Error(
      'composeThemedSleeve: SVG has no <g data-layer="dieline"> group. ' +
      'Was this SVG produced by generateSleeveNet?'
    );
  }

  // 1. Build the bleed-extended cut perimeter polygon in viewBox space and
  //    install it as a <clipPath> in <defs>.
  const polygon = buildBleedExtendedPolygon(dieline);
  const defs = findOrCreateDefs(svg);

  const clipPath = document.createElementNS(SVG_NS, 'clipPath');
  clipPath.setAttribute('id', clipId);
  // clipPathUnits defaults to userSpaceOnUse — explicit for clarity; matches
  // the polygon being authored in viewBox coordinates rather than relative
  // to the bounding box of the clipped element.
  clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');

  const polyEl = document.createElementNS(SVG_NS, 'polygon');
  polyEl.setAttribute('points', pointsAttr(polygon));
  polyEl.setAttribute('data-role', 'composition-clip-polygon');
  clipPath.appendChild(polyEl);
  defs.appendChild(clipPath);

  // 2. Build the art layer.
  let titleStartX = null;
  const artLayer = document.createElementNS(SVG_NS, 'g');
  artLayer.setAttribute('data-layer', 'art');
  artLayer.setAttribute('data-theme-id', theme.id);

  if (theme.placement === 'front-centre') {
    // Two-layer composition: brocade + parchment overlay, both clipped to the
    // trim edge (cut perimeter). Neither extends into the bleed zone.

    const b   = dieline.bleedMm;
    const trimW = dieline.trim.width;
    const trimH = dieline.trim.height;

    const trimClipId = `${clipId}-trim`;
    const trimClipPath = document.createElementNS(SVG_NS, 'clipPath');
    trimClipPath.setAttribute('id', trimClipId);
    trimClipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const trimPolyEl = document.createElementNS(SVG_NS, 'polygon');
    trimPolyEl.setAttribute('points', pointsAttr(buildTrimPolygon(dieline)));
    trimClipPath.appendChild(trimPolyEl);
    defs.appendChild(trimClipPath);

    const brocadeImg = document.createElementNS(SVG_NS, 'image');
    brocadeImg.setAttribute('href', `/backgrounds/${brocadeFile}`);
    brocadeImg.setAttribute('x', String(b));
    brocadeImg.setAttribute('y', String(b));
    brocadeImg.setAttribute('width', String(trimW));
    brocadeImg.setAttribute('height', String(trimH));
    brocadeImg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    brocadeImg.setAttribute('clip-path', `url(#${trimClipId})`);
    brocadeImg.setAttribute('data-role', 'composition-brocade');
    artLayer.appendChild(brocadeImg);

    const overlayImg = document.createElementNS(SVG_NS, 'image');
    overlayImg.setAttribute('href', theme.art);
    overlayImg.setAttribute('x', String(b));
    overlayImg.setAttribute('y', String(b));
    overlayImg.setAttribute('width', String(trimW));
    overlayImg.setAttribute('height', String(trimH));
    overlayImg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    overlayImg.setAttribute('clip-path', `url(#${trimClipId})`);
    overlayImg.setAttribute('data-role', 'composition-art');
    artLayer.appendChild(overlayImg);

    if (logoHref) {
      const front = dieline.panels.front;
      const LOGO_MARGIN_MM = 2.5;
      const logoH = front.height - 2 * LOGO_MARGIN_MM;
      const logoX = b + front.x + LOGO_MARGIN_MM + logoH;
      titleStartX = logoX + logoH + 5;
      const logoEl = document.createElementNS(SVG_NS, 'image');
      logoEl.setAttribute('href', logoHref);
      logoEl.setAttribute('x', String(logoX));
      logoEl.setAttribute('y', String(b + front.y + LOGO_MARGIN_MM));
      logoEl.setAttribute('width', String(logoH));
      logoEl.setAttribute('height', String(logoH));
      logoEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      logoEl.setAttribute('clip-path', `url(#${trimClipId})`);
      logoEl.setAttribute('data-role', 'composition-logo');
      artLayer.appendChild(logoEl);
    }

  } else {
    // Original full-dieline mode: art is authored at exact viewBox dimensions.
    const image = document.createElementNS(SVG_NS, 'image');
    image.setAttribute('href', theme.art);
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('width', String(dieline.viewBox.width));
    image.setAttribute('height', String(dieline.viewBox.height));
    image.setAttribute('preserveAspectRatio', 'none');
    image.setAttribute('clip-path', `url(#${clipId})`);
    image.setAttribute('data-role', 'composition-art');
    artLayer.appendChild(image);
  }

  // 3. Insert the art layer BEFORE the existing dieline group so the cut and
  //    fold lines stamp on top of the art and remain visible at print scale.
  svg.insertBefore(artLayer, dielineGroup);

  // 4. Optional title text centred on the front face (Story 1.4).
  if (title && title.trim() !== '') {
    composeTitleLayer(svg, dieline, title.trim(), titleMode, spineColor, titleStartX);
  }

  // 5. Provenance mark in the glue tab (Story 1.7).
  composeProvenanceMark(svg, dieline);

  // 6. Assembly guide strip below the net (Story 1.8).
  composeAssemblyGuide(svg, dieline);

  return { svg };
}

/**
 * Helper exposed for the dev verification page: returns the bleed-extended
 * cut perimeter polygon as a points-attribute string. The dev page draws an
 * outline of this polygon as a "show clip mask" toggle so the polygon math
 * can be eyeballed against the geometry layer's cut path.
 */
export function bleedExtendedClipPathPoints(dieline) {
  return pointsAttr(buildBleedExtendedPolygon(dieline));
}
