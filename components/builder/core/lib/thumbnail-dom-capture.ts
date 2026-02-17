/**
 * thumbnail-dom-capture.ts
 *
 * Primary thumbnail generation via DOM capture.  Clones the live
 * #TrackVisualLayer element (tiles only — no grid, ghosts, or
 * editor overlays), strips interaction overlays (selection, hover,
 * edge errors, dashed borders), deep-inlines all computed styles
 * so CSS variables and Tailwind classes survive serialisation,
 * then rasterises via SVG foreignObject → Image → offscreen Canvas
 * → PNG data URL at 260×180.
 *
 * Usage:
 *   import { captureThumbnailSVG } from './lib/thumbnail-dom-capture';
 *   const dataUrl = await captureThumbnailSVG();
 *   // <img src={dataUrl} width={260} height={180} />
 */

import { CELL_SIZE } from '@/types/builder';

/* ═══════════════════════════════════════════════════════════════════════
 *  Constants
 * ═══════════════════════════════════════════════════════════════════════ */

const THUMB_W = 260;
const THUMB_H = 180;
const PADDING = 20;
const BG_COLOR = '#141821';

/* ═══════════════════════════════════════════════════════════════════════
 *  1. Locate #TrackVisualLayer
 * ═══════════════════════════════════════════════════════════════════════ */

function findTrackVisualLayer(): HTMLElement | null {
  return document.getElementById('TrackVisualLayer');
}

/* ═══════════════════════════════════════════════════════════════════════
 *  2. Bounding box — union of getBoundingClientRect() on all tiles
 *     converted back to TrackVisualLayer-local coordinates.
 * ═══════════════════════════════════════════════════════════════════════ */

interface LocalBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Computes a tight bounding box in TrackVisualLayer-local pixel
 * coordinates by calling getBoundingClientRect() on every [data-tile]
 * node and converting to local space via the current zoom factor.
 */
function computeLocalBBox(
  layer: HTMLElement,
  tileEls: HTMLElement[],
): LocalBBox | null {
  if (tileEls.length === 0) return null;

  // Derive zoom from the first tile's screen size vs known local size
  const sampleRect = tileEls[0].getBoundingClientRect();
  const zoom = sampleRect.width / CELL_SIZE;
  if (zoom === 0) return null;

  // Layer origin in screen space
  const layerRect = layer.getBoundingClientRect();

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const el of tileEls) {
    const r = el.getBoundingClientRect();
    const localLeft = (r.left - layerRect.left) / zoom;
    const localTop = (r.top - layerRect.top) / zoom;
    const localRight = localLeft + CELL_SIZE;
    const localBottom = localTop + CELL_SIZE;
    minX = Math.min(minX, localLeft);
    minY = Math.min(minY, localTop);
    maxX = Math.max(maxX, localRight);
    maxY = Math.max(maxY, localBottom);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  3. Uniform-fit scaling (20 px padding, centered in 260×180)
 * ═══════════════════════════════════════════════════════════════════════ */

interface FitResult {
  scale: number;
  offsetX: number;
  offsetY: number;
}

function computeFit(bboxW: number, bboxH: number): FitResult {
  const availW = THUMB_W - PADDING * 2;
  const availH = THUMB_H - PADDING * 2;
  const scale = Math.min(availW / bboxW, availH / bboxH);
  const scaledW = bboxW * scale;
  const scaledH = bboxH * scale;
  return {
    scale,
    offsetX: (THUMB_W - scaledW) / 2,
    offsetY: (THUMB_H - scaledH) / 2,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  4. Strip interaction overlays from cloned tiles
 *
 *  TileRenderer children (by z-index):
 *    z:0 — bg tint (selection/hover/ghost tint)     → REMOVE
 *    z:1 — tile graphic (rotation wrapper + SVG/div) → KEEP
 *    z:2 — dashed grid border                       → REMOVE
 *    z:3 — hover highlight border                   → REMOVE
 *    z:4 — edge-error SVG indicators                → REMOVE
 *    z:5 — selection glow outlines                  → REMOVE
 *    z:6 — error tooltip hover zones                → REMOVE
 * ════���══════════════════════════════════════════════════════════════════ */

function stripOverlaysFromClone(clonedLayer: HTMLElement) {
  const tiles = clonedLayer.querySelectorAll<HTMLElement>('[data-tile]');

  for (const tile of tiles) {
    // Force full opacity (undo drag dimming)
    tile.style.opacity = '1';
    tile.style.animation = 'none';
    tile.style.cursor = 'default';
    tile.removeAttribute('draggable');

    // The TileRenderer root is the first child of the data-tile wrapper
    const rendererRoot = tile.firstElementChild as HTMLElement | null;
    if (!rendererRoot) continue;

    rendererRoot.style.opacity = '1';

    // Keep only the tile graphic child (z-index 1)
    const children = Array.from(rendererRoot.children) as HTMLElement[];
    for (const child of children) {
      if (child.style.zIndex === '1') {
        // Keeper — kill transitions
        child.style.transition = 'none';
        continue;
      }
      // Remove everything else (tint, dashed border, hover, errors, selection)
      rendererRoot.removeChild(child);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 *  5. Deep-inline all computed styles
 *
 *  foreignObject SVGs are rendered in an isolated image context with
 *  NO access to stylesheets or CSS custom properties.  Every visual
 *  property must be fully resolved and written as inline style.
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Copy all computed style properties from `orig` to `clone`, then
 * recurse into children.  This resolves Tailwind utilities, CSS vars,
 * inherited styles — everything the browser computed.
 */
function deepInlineStyles(orig: Element, clone: Element) {
  // ── HTML elements ──────────────────────────────────────────────────
  if (orig instanceof HTMLElement && clone instanceof HTMLElement) {
    const cs = window.getComputedStyle(orig);
    // Build a full inline style string from every computed property
    const parts: string[] = [];
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i];
      parts.push(`${prop}:${cs.getPropertyValue(prop)}`);
    }
    clone.setAttribute('style', parts.join(';'));
    // Drop class — it's meaningless without stylesheets
    clone.removeAttribute('class');
  }

  // ── SVG elements — resolve fill/stroke var() attributes ────────────
  if (
    orig.namespaceURI === 'http://www.w3.org/2000/svg' ||
    orig.tagName.toLowerCase() === 'svg'
  ) {
    resolveSVGVars(orig, clone);
  }

  // ── Recurse children ───────────────────────────────────────────────
  const oChildren = orig.children;
  const cChildren = clone.children;
  const len = Math.min(oChildren.length, cChildren.length);
  for (let i = 0; i < len; i++) {
    deepInlineStyles(oChildren[i], cChildren[i]);
  }
}

/**
 * Walk SVG shape descendants and replace any `fill` or `stroke`
 * attribute containing `var(` with the browser-resolved value.
 */
function resolveSVGVars(orig: Element, clone: Element) {
  const SHAPES = 'rect,path,circle,line,ellipse,polygon,polyline';
  const origShapes = orig.querySelectorAll(SHAPES);
  const cloneShapes = clone.querySelectorAll(SHAPES);

  cloneShapes.forEach((cEl, i) => {
    const oEl = origShapes[i];
    if (!oEl) return;

    for (const attr of ['fill', 'stroke'] as const) {
      const raw = cEl.getAttribute(attr);
      if (raw && raw.includes('var(')) {
        const resolved = window.getComputedStyle(oEl).getPropertyValue(attr);
        if (resolved) cEl.setAttribute(attr, resolved);
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════
 *  6. Empty-state fallback
 * ═══════════════════════════════════════════════════════════════════════ */

function createEmptyThumbnail(): string {
  const c = document.createElement('canvas');
  c.width = THUMB_W;
  c.height = THUMB_H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, THUMB_W, THUMB_H);
  return c.toDataURL('image/png');
}

/* ═══════════════════════════════════════════════════════════════════════
 *  captureThumbnailSVG()  —  PRIMARY THUMBNAIL METHOD
 *
 *  Pipeline:
 *    #TrackVisualLayer (live DOM)
 *      → clone
 *      → strip overlays
 *      → deep-inline computed styles (resolve Tailwind + CSS vars)
 *      → compute tight local bbox via getBoundingClientRect()
 *      → CSS transform to crop (translate bbox→0,0) + scale + center
 *      → wrap in <svg><foreignObject>
 *      → serialize SVG string
 *      → new Image(src = blob URL)
 *      → drawImage onto offscreen 260×180 canvas
 *      → toDataURL('image/png')
 * ═══════════════════════════════════════════════════════════════════════ */

export async function captureThumbnailSVG(): Promise<string> {
  // ── 1. Find the live layer ─────────────────────────────────────────
  const layer = findTrackVisualLayer();
  if (!layer) {
    console.warn('[thumbnail] #TrackVisualLayer not found');
    return createEmptyThumbnail();
  }

  const liveTiles = Array.from(
    layer.querySelectorAll<HTMLElement>('[data-tile]'),
  );
  if (liveTiles.length === 0) return createEmptyThumbnail();

  // ── 2. Bounding box (getBoundingClientRect → local coords) ────────
  const bbox = computeLocalBBox(layer, liveTiles);
  if (!bbox) return createEmptyThumbnail();

  // ── 3. Clone the entire TrackVisualLayer ───────────────────────────
  const clone = layer.cloneNode(true) as HTMLElement;

  // ── 4. Deep-inline computed styles FIRST (while clone tree matches
  //    the original tree structure exactly — same child count/order).
  //    This resolves every Tailwind class + CSS custom property into
  //    explicit inline values so foreignObject renders correctly.
  deepInlineStyles(layer, clone);

  // ── 5. THEN strip selection / hover / error / grid-border overlays.
  //    Now that styles are fully inlined, removing overlay children
  //    won't affect the remaining tile graphic nodes.
  stripOverlaysFromClone(clone);

  // ── 6. Force clean state on all surviving tile wrappers ────────────
  const clonedTiles = clone.querySelectorAll<HTMLElement>('[data-tile]');
  for (const t of clonedTiles) {
    t.style.opacity = '1';
    t.style.animation = 'none';
    t.style.cursor = 'default';
  }

  // ── 7. Compute uniform fit ─────────────────────────────────────────
  const fit = computeFit(bbox.width, bbox.height);

  // ── 8. Apply crop + scale + center transform to the clone root ─────
  //    Order (CSS reads right-to-left):
  //      1. translate(-minX, -minY) — shift bbox origin to 0,0
  //      2. scale(fit.scale)        — uniform scale to fit 260×180
  //      3. translate(offsetX, offsetY) — center in the thumbnail
  clone.setAttribute('style', [
    'position:absolute',
    'top:0',
    'left:0',
    `transform-origin:0 0`,
    `transform:translate(${fit.offsetX}px,${fit.offsetY}px) scale(${fit.scale}) translate(${-bbox.minX}px,${-bbox.minY}px)`,
  ].join(';'));

  // ── 9. Build the foreignObject SVG string ──────────────────────────
  const wrapperHTML = clone.outerHTML;

  const svgStr = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_W}" height="${THUMB_H}">`,
    `<foreignObject width="100%" height="100%">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${THUMB_W}px;height:${THUMB_H}px;background:${BG_COLOR};overflow:hidden;position:relative;">`,
    wrapperHTML,
    `</div>`,
    `</foreignObject>`,
    `</svg>`,
  ].join('');

  // ── 10. Rasterise: SVG blob → Image → offscreen Canvas → PNG ──────
  const blob = new Blob([svgStr], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const blobUrl = URL.createObjectURL(blob);

  return new Promise<string>((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = THUMB_W;
      canvas.height = THUMB_H;
      const ctx = canvas.getContext('2d')!;

      // Solid background first (fills any transparent regions)
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, THUMB_W, THUMB_H);

      // Draw the rasterised SVG
      ctx.drawImage(img, 0, 0, THUMB_W, THUMB_H);

      URL.revokeObjectURL(blobUrl);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Failed to rasterise TrackVisualLayer thumbnail'));
    };

    img.src = blobUrl;
  });
}