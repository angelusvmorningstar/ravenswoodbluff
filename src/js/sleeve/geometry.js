/**
 * Parametric SVG net generator for the Ravenswood Bluff box sleeve.
 *
 * Produces a square wrap-only sleeve net for a configurable donor box.
 * The sleeve wraps the cross-section (top, front, bottom, back panels +
 * glue tab) and is intentionally shorter than the box along the length
 * axis — the small end faces and a portion of the long faces stay exposed
 * so the donor box's own printed art shows through at both ends.
 *
 * Layout (portrait page, square net):
 *   - Net X axis = wrap perimeter = assembled tube length (≈205mm Carousel)
 *   - Net Y axis = wrap perimeter = sum of row heights (cross-section + glue)
 *   - Rows are horizontal stripes stacked top-to-bottom
 *   - Fold lines are horizontal, parallel to the box length axis
 *   - When assembled, the tube axis runs along the net's X direction
 *
 * Public API:
 *   generateSleeveNet({ donorBox, paperSize, shaved })
 *     - donorBox: parsed JSON from src/data/sleeves/donor-boxes/<id>.json
 *     - paperSize: 'A4' | 'Letter'
 *     - shaved: optional boolean. Historically controlled the symmetric-
 *               shave on tube length in the original full-coverage design.
 *               With the wrap-only design, the net dimensions no longer
 *               depend on tube length, so this parameter is functionally
 *               a no-op for geometry. It is retained for API compatibility
 *               and surfaces in the returned dieline alongside `tubeLength`
 *               for downstream/informational use.
 *               Note: paperSize no longer affects net dimensions either —
 *               both A4 and Letter produce an identical square net.
 *               paperSize is preserved in the returned dieline for
 *               pdf-adapter use (page-size declaration only).
 *
 *   Returns: { svg: SVGSVGElement, dieline: { ... } }
 *     - svg: a fully composed SVGSVGElement with cut, fold, and glue-tab geometry
 *     - dieline: structured metadata describing trim space and panel rectangles
 *               for downstream art-composition stories (Story 1.2 onward)
 *
 *   computeNetDimensions({ donorBox, paperSize, shaved })
 *     Pure, DOM-free computation of net dimensions. Safe to call from Node.
 *     generateSleeveNet and the internal SVG composition require a global
 *     `document` (uses document.createElementNS) and will throw in non-DOM
 *     environments.
 *
 * Geometry layer only. Does not import any PDF library; SVG output is the
 * single source of truth for downstream PDF generation in Story 1.6.
 *
 * Dimensions are in millimetres throughout. The SVG viewBox is sized in
 * user-units that map 1:1 to mm; the SVG element also carries explicit
 * width and height attributes in mm so the rendered output is at locked
 * physical scale regardless of the consumer's CSS context.
 */

// Module-level constants. Per AC6, these are named at the top of the module
// so future donor boxes are a config swap and the geometry has no inline
// magic numbers.
const GLUE_TAB_MM = 12;
const BLEED_MM = 5;
const SYMMETRIC_SHAVE_MM = 7.5;
const GLUE_TAB_CHAMFER_MM = 5;

const PAPER_SIZES = {
  A4: { widthMm: 210, heightMm: 297 },
  Letter: { widthMm: 216, heightMm: 279 },
};

const SVG_NS = 'http://www.w3.org/2000/svg';

// Stroke conventions from box-sleeve-spec.md, Print-and-assemble UX
// requirements: cut lines solid hairline black, valley folds dotted ~30% K.
// SVG stroke widths are in mm to match the user-unit space.
const STROKE = {
  cutMm: 0.5, // bold hairline — easy to follow with scissors at home-printer scale
  foldMm: 0.088, // ~0.25pt
  cutColor: '#000',
  foldColor: '#b3b3b3', // 30% grey
  foldDashMm: '0.6 0.6',
};

/**
 * Pure computation of net dimensions. No DOM access; safe to test from any
 * environment. Returns numbers in mm.
 */
export function computeNetDimensions({ donorBox, paperSize, shaved }) {
  const paper = PAPER_SIZES[paperSize];
  if (!paper) {
    throw new Error(`Unknown paperSize "${paperSize}". Expected one of: ${Object.keys(PAPER_SIZES).join(', ')}.`);
  }

  // Default: shaved on both A4 and Letter so the bare-end reveal matches
  // across paper sizes (per spec). A4 callers can pass shaved=false for the
  // full-coverage variant; Letter callers cannot opt out.
  const useShaved = typeof shaved === 'boolean' ? shaved : true;

  const { length: boxLength, depth: boxDepth, height: boxHeight } = donorBox.dimensions;
  const { lengthAxis: clearanceLen, crossSectionPerAxis: clearanceXSec } = donorBox.clearance;

  const interiorDepth = boxDepth + clearanceXSec;
  const interiorHeight = boxHeight + clearanceXSec;
  const crossSectionPerimeter = 2 * (interiorDepth + interiorHeight);
  const fullTubeLength = boxLength + clearanceLen;
  const tubeLength = useShaved ? fullTubeLength - 2 * SYMMETRIC_SHAVE_MM : fullTubeLength;

  // Wrap-only sleeve: the net covers the box cross-section but deliberately
  // does NOT span the full box length — the box ends stay exposed so the
  // donor box's printed end art shows through. Both axes equal the wrap
  // perimeter (cross-section + glue tab), giving a square net (≈205×205mm
  // for Carousel). When assembled, the tube axis runs along the net's X
  // dimension (parallel to the horizontal fold lines), so the assembled
  // sleeve is `wrapPerimeterMm` long along the box's length axis.
  //
  // The tubeLength value above is retained for informational use in the
  // returned dieline; it no longer drives net dimensions.
  const wrapPerimeterMm = crossSectionPerimeter + GLUE_TAB_MM;
  const trimWidthMm = wrapPerimeterMm;
  const trimHeightMm = wrapPerimeterMm;

  // Bleed adds 5mm on every outer edge of the trim rectangle.
  const viewBoxWidthMm = trimWidthMm + 2 * BLEED_MM;
  const viewBoxHeightMm = trimHeightMm + 2 * BLEED_MM;

  // Sanity check: the net (incl. bleed) must fit within the paper's long
  // edge. For the Carousel donor box this passes trivially on both A4 and
  // Letter (215mm net vs 297/279mm long edge), but the check guards against
  // future donor boxes with cross-sections too large for the page.
  const paperLongEdge = Math.max(paper.widthMm, paper.heightMm);
  if (viewBoxHeightMm > paperLongEdge) {
    throw new Error(
      `Net wrap perimeter ${viewBoxHeightMm}mm (incl. bleed) exceeds ${paperSize}'s long edge ${paperLongEdge}mm. Donor box cross-section is too large for this paper.`
    );
  }

  return {
    paperSize,
    shaved: useShaved,
    interiorDepth,
    interiorHeight,
    crossSectionPerimeter,
    tubeLength,
    fullTubeLength,
    trimWidthMm,
    trimHeightMm,
    viewBoxWidthMm,
    viewBoxHeightMm,
    glueTabMm: GLUE_TAB_MM,
    glueTabChamferMm: GLUE_TAB_CHAMFER_MM,
    bleedMm: BLEED_MM,
  };
}

/**
 * Builds the panel-rectangle metadata in trim-space coordinates (origin at
 * the top-left of the trim rectangle, before bleed). Story 1.2 consumes
 * this to clip art into specific panels without re-deriving positions.
 */
function buildPanels(net) {
  const { trimWidthMm, interiorDepth, interiorHeight } = net;

  let y = 0;
  const top    = { x: 0, y, width: trimWidthMm, height: interiorDepth };
  y += interiorDepth;
  const front  = { x: 0, y, width: trimWidthMm, height: interiorHeight };
  y += interiorHeight;
  const bottom = { x: 0, y, width: trimWidthMm, height: interiorDepth };
  y += interiorDepth;
  const back   = { x: 0, y, width: trimWidthMm, height: interiorHeight };
  y += interiorHeight;
  const glueTab = { x: 0, y, width: trimWidthMm, height: GLUE_TAB_MM };

  return { top, front, bottom, back, glueTab };
}

/**
 * Composes the SVG element: a single closed cut path tracing the entire
 * outer perimeter (incl. the chamfered glue-tab corner), and valley fold
 * lines between panels. The chamfer on the lower-right corner of the glue
 * tab is the asymmetric "this way only" cue; the rest of the perimeter is
 * a clean rectangle.
 *
 * Note: the back/glue-tab boundary is a FOLD only, never a cut. The cut
 * path goes around the outside of the tab; the fold sits across the
 * interior at y = crossSectionPerimeter.
 */
function buildDielineSvg(net, panels) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `0 0 ${net.viewBoxWidthMm} ${net.viewBoxHeightMm}`);
  svg.setAttribute('width', `${net.viewBoxWidthMm}mm`);
  svg.setAttribute('height', `${net.viewBoxHeightMm}mm`);
  svg.setAttribute('data-paper-size', net.paperSize);
  svg.setAttribute('data-shaved', String(net.shaved));

  // Translate into trim-space so the rest of the SVG ignores bleed offset.
  const trimGroup = document.createElementNS(SVG_NS, 'g');
  trimGroup.setAttribute('transform', `translate(${BLEED_MM}, ${BLEED_MM})`);
  trimGroup.setAttribute('data-layer', 'dieline');
  svg.appendChild(trimGroup);

  // Outer cut perimeter: a single closed path tracing the trim rectangle
  // with a chamfer on the lower-right corner of the glue tab.
  const w = net.trimWidthMm;
  const h = net.trimHeightMm;
  const c = GLUE_TAB_CHAMFER_MM;
  const cutPath = document.createElementNS(SVG_NS, 'path');
  cutPath.setAttribute('d', `M 0 0 H ${w} V ${h - c} L ${w - c} ${h} H 0 Z`);
  cutPath.setAttribute('fill', 'none');
  cutPath.setAttribute('stroke', STROKE.cutColor);
  cutPath.setAttribute('stroke-width', String(STROKE.cutMm));
  cutPath.setAttribute('stroke-linejoin', 'miter');
  cutPath.setAttribute('data-role', 'cut-trim');
  trimGroup.appendChild(cutPath);

  // Valley fold lines: four horizontals separating top/front, front/bottom,
  // bottom/back, and back/glue-tab.
  const foldYs = [
    panels.front.y,
    panels.bottom.y,
    panels.back.y,
    panels.glueTab.y,
  ];
  for (const y of foldYs) {
    const fold = document.createElementNS(SVG_NS, 'line');
    fold.setAttribute('x1', '0');
    fold.setAttribute('y1', String(y));
    fold.setAttribute('x2', String(net.trimWidthMm));
    fold.setAttribute('y2', String(y));
    fold.setAttribute('stroke', STROKE.foldColor);
    fold.setAttribute('stroke-width', String(STROKE.foldMm));
    fold.setAttribute('stroke-dasharray', STROKE.foldDashMm);
    fold.setAttribute('data-role', 'fold-valley');
    trimGroup.appendChild(fold);
  }

  return svg;
}

/**
 * Public entry point.
 */
export function generateSleeveNet({ donorBox, paperSize, shaved }) {
  const net = computeNetDimensions({ donorBox, paperSize, shaved });
  const panels = buildPanels(net);
  const svg = buildDielineSvg(net, panels);

  const dieline = {
    paperSize: net.paperSize,
    shaved: net.shaved,
    units: 'mm',
    bleedMm: net.bleedMm,
    glueTabMm: net.glueTabMm,
    // Chamfer is on the lower-right corner of the glueTab panel rectangle.
    // Story 1.2 should mask art away from this triangular cut so glued art
    // doesn't bleed past the trim edge.
    glueTabChamferMm: net.glueTabChamferMm,
    glueTabChamferCorner: 'bottom-right',
    trim: { width: net.trimWidthMm, height: net.trimHeightMm },
    viewBox: { width: net.viewBoxWidthMm, height: net.viewBoxHeightMm },
    panels,
  };

  return { svg, dieline };
}
