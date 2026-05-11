/**
 * PDF export adapter for the box sleeve generator.
 *
 * The ONLY module in the sleeve pipeline that imports pdf-lib. Geometry and
 * composition modules are strictly PDF-free; this adapter bridges them to
 * the PDF format.
 *
 * Public API:
 *   exportSleeveAsPdf({ svgElement, paperSize })
 *     - svgElement: the SVGSVGElement currently in the preview surface
 *     - paperSize: 'A4' | 'Letter'
 *   Returns: Promise<Uint8Array> — raw PDF bytes ready for download
 *
 * The adapter:
 *   1. Clones the SVG and inlines all <image href> assets as base64 data URLs
 *      so the rasteriser can reach them from a blob: URL context.
 *   2. Rasterises the SVG to a canvas at 200 DPI (sufficient for home-print
 *      line art; higher DPI is limited by the donor theme PNG quality anyway).
 *   3. Embeds the PNG into a pdf-lib page sized to the chosen paper in
 *      portrait orientation, with the sleeve net (and any embedded assembly
 *      guide) placed flush against the top edge.
 *   4. Renders a small print-fit instruction line in the bottom margin via
 *      pdf-lib text drawing — present on the printed page, absent from the
 *      on-screen builder preview which renders the SVG only.
 *
 * Known v1 limitation: CSS @font-face rules (Cinzel) are not available in
 * the blob-URL rasterisation context, so title text falls back to the generic
 * serif family in the PDF. This is acceptable for the placeholder theme.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// 1 inch = 25.4 mm; 1 pt = 1/72 inch
const MM_TO_PT = 72 / 25.4;
const RASTER_DPI = 200;
const MM_TO_PX = RASTER_DPI / 25.4;

// PDF page dimensions in mm (portrait orientation: long edge runs vertical).
// The wrap-only sleeve net is square, so the long edge accommodates the
// assembly guide and the print-fit instruction line below the net.
const PAPER_PORTRAIT_MM = {
  A4:     { width: 210, height: 297 },
  Letter: { width: 216, height: 279 },
};

// Print-fit instruction: a single line of small grey text rendered in the
// bottom page margin, telling the user how to set their printer dialogue.
// Keep the text comma-separated (no em-dashes) per project prose conventions.
const PRINT_FIT_INSTRUCTION = 'Print at actual size, or Fit to Page if your printer prompts.';
const INSTRUCTION_FONT_SIZE_PT = 9;
const INSTRUCTION_BOTTOM_MARGIN_MM = 6;
const INSTRUCTION_COLOR_RGB = { r: 0.4, g: 0.4, b: 0.4 }; // 40% black

function getViewBoxMm(svgEl) {
  const vb = svgEl.getAttribute('viewBox');
  if (!vb) throw new Error('pdf-adapter: SVG has no viewBox attribute.');
  const parts = vb.trim().split(/[\s,]+/);
  const w = parseFloat(parts[2]);
  const h = parseFloat(parts[3]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error(`pdf-adapter: invalid viewBox "${vb}".`);
  }
  return { width: w, height: h };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = () => reject(new Error('pdf-adapter: FileReader error'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function inlineImageHrefs(svgClone) {
  const images = svgClone.querySelectorAll('image[href]');
  await Promise.all(Array.from(images).map(async img => {
    const href = img.getAttribute('href');
    if (!href || href.startsWith('data:')) return;
    try {
      const resp = await fetch(href);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const dataUrl = await blobToDataUrl(await resp.blob());
      img.setAttribute('href', dataUrl);
    } catch (err) {
      // Non-fatal: theme art missing in PDF is better than a broken download.
      console.warn(`pdf-adapter: could not inline image "${href}":`, err);
    }
  }));
}

async function rasteriseSvgToPng(svgEl, widthMm, heightMm) {
  const pxW = Math.round(widthMm * MM_TO_PX);
  const pxH = Math.round(heightMm * MM_TO_PX);

  // Clone and inline images before serialisation so they resolve from a
  // blob: URL context where relative paths would otherwise fail.
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('width', String(pxW));
  clone.setAttribute('height', String(pxH));
  await inlineImageHrefs(clone);

  const svgStr = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pxW, pxH);

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0); resolve(); };
    img.onerror = () => reject(new Error('pdf-adapter: SVG rasterisation failed.'));
    img.src = blobUrl;
  });
  URL.revokeObjectURL(blobUrl);

  return dataUrlToUint8Array(canvas.toDataURL('image/png'));
}

export async function exportSleeveAsPdf({ svgElement, paperSize }) {
  const paper = PAPER_PORTRAIT_MM[paperSize];
  if (!paper) throw new Error(`pdf-adapter: unknown paperSize "${paperSize}".`);

  const net = getViewBoxMm(svgElement);
  const pngBytes = await rasteriseSvgToPng(svgElement, net.width, net.height);

  const pdfDoc = await PDFDocument.create();
  const pageW = paper.width * MM_TO_PT;
  const pageH = paper.height * MM_TO_PT;
  const page = pdfDoc.addPage([pageW, pageH]);

  const pngImage = await pdfDoc.embedPng(pngBytes);

  const imgW = net.width * MM_TO_PT;
  const imgH = net.height * MM_TO_PT;
  // Centre horizontally. If the SVG (with bleed) is wider than the page, the
  // bleed is clipped equally on both sides — bleed loss is harmless by design.
  const x = (pageW - imgW) / 2;
  // Flush to the top of the page (pdf-lib uses bottom-left origin, so the
  // image's bottom edge sits at pageH - imgH). Any spare page height drops
  // into the bottom margin where the print-fit instruction lives.
  const y = pageH - imgH;

  page.drawImage(pngImage, { x, y, width: imgW, height: imgH });

  // Print-fit instruction in the bottom margin. Rendered after drawImage so
  // it sits above the net image even if the bleed reaches the bottom edge.
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const textWidthPt = font.widthOfTextAtSize(PRINT_FIT_INSTRUCTION, INSTRUCTION_FONT_SIZE_PT);
  page.drawText(PRINT_FIT_INSTRUCTION, {
    x: (pageW - textWidthPt) / 2,
    y: INSTRUCTION_BOTTOM_MARGIN_MM * MM_TO_PT,
    size: INSTRUCTION_FONT_SIZE_PT,
    font,
    color: rgb(INSTRUCTION_COLOR_RGB.r, INSTRUCTION_COLOR_RGB.g, INSTRUCTION_COLOR_RGB.b),
  });

  return pdfDoc.save();
}
