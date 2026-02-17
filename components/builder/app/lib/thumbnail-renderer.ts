/**
 * thumbnail-renderer.ts
 *
 * Renders a 1:1 PNG thumbnail of the current track layout using an offscreen
 * canvas.  Only draws TrackVisualLayer tiles — no grid lines, overlays,
 * selection highlights, or edge-error indicators.
 *
 * Usage:
 *   import { renderThumbnail } from './lib/thumbnail-renderer';
 *   const dataUrl = renderThumbnail({ tiles, cellSize: 288 });
 *   // dataUrl is a "data:image/png;base64,…" string ready for <img src>
 */

import type { PlacedTile, TileType } from '../types';

/* ── Configuration ──────────────────────────────────────────────── */

const THUMB_W = 260;
const THUMB_H = 180;
const PADDING = 20; // px around the bounding box
const BG_COLOR = '#141821';

// Per-tile-type fill colors – matches the visual style from TileRenderer
const TILE_FILL: Record<TileType, string> = {
  'straight': '#5B6475',
  'corner': '#5B6475',
  'inside-corner': '#5B6475',
  'inside-corner-45': '#5B6475',
  'bump': '#5B6475',
  'diagonal': '#5B6475',
  'blank': '#3A3F4C',
};

// Accent colors used within tile shapes (lane strip, corner arc, etc.)
const LANE_COLOR = '#8B92A1';
const ACCENT_COLOR = '#E05555';
const DOT_COLOR = '#9CA3AF';
const CANVAS_BG_COLOR = '#2A303E'; // for transparent parts of corner / diagonal

/* ── Bounding-box helper ────────────────────────────────────────── */

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

function computeBoundingBox(tiles: PlacedTile[]): BBox | null {
  if (tiles.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tiles) {
    if (t.x < minX) minX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.x > maxX) maxX = t.x;
    if (t.y > maxY) maxY = t.y;
  }
  // Add 1 to max because grid coords are top-left of the cell
  return {
    minX,
    minY,
    maxX: maxX + 1,
    maxY: maxY + 1,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/* ── Uniform-fit scaling ────────────────────────────────────────── */

interface FitResult {
  scale: number;
  offsetX: number;
  offsetY: number;
}

function computeFit(bbox: BBox, cellSize: number, w: number = THUMB_W, h: number = THUMB_H): FitResult {
  const worldW = bbox.width * cellSize;
  const worldH = bbox.height * cellSize;
  const availW = w - PADDING * 2;
  const availH = h - PADDING * 2;
  const scale = Math.min(availW / worldW, availH / worldH);
  const scaledW = worldW * scale;
  const scaledH = worldH * scale;
  const offsetX = (w - scaledW) / 2;
  const offsetY = (h - scaledH) / 2;
  return { scale, offsetX, offsetY };
}

/* ── Individual tile draw functions (native 1×1 cell unit) ────── */
// Each function draws into a canvas context that has been translated + rotated
// so (0,0) is the tile's top-left corner and the cell occupies [0..1] × [0..1].

type TileDrawFn = (ctx: CanvasRenderingContext2D, s: number) => void;

function drawStraight(ctx: CanvasRenderingContext2D, s: number) {
  // Dark background
  ctx.fillStyle = TILE_FILL['straight'];
  ctx.fillRect(0, 0, s, s);
  // Lane strip along top edge
  const laneH = s * (31 / 144);
  ctx.fillStyle = LANE_COLOR;
  ctx.fillRect(0, 0, s, laneH);
  // Dots
  ctx.fillStyle = DOT_COLOR;
  const r = s * (4 / 144);
  ctx.beginPath();
  ctx.arc(s * (14 / 144), s * (16 / 144), r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s * (130 / 144), s * (16 / 144), r, 0, Math.PI * 2);
  ctx.fill();
}

function drawCorner(ctx: CanvasRenderingContext2D, s: number) {
  // Background (transparent area) — canvas BG shows through
  ctx.fillStyle = CANVAS_BG_COLOR;
  ctx.fillRect(0, 0, s, s);

  // Outer red arc (quarter circle, bottom-right rounded)
  ctx.fillStyle = ACCENT_COLOR;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s, 0);
  ctx.lineTo(s, 0);
  ctx.arcTo(s, s, 0, s, s);
  ctx.lineTo(0, s);
  ctx.closePath();
  ctx.fill();

  // Inner dark arc (smaller quarter circle)
  const innerS = s * (116 / 144);
  ctx.fillStyle = TILE_FILL['corner'];
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(innerS, 0);
  ctx.arcTo(innerS, innerS, 0, innerS, innerS);
  ctx.lineTo(0, innerS);
  ctx.closePath();
  ctx.fill();

  // Dots
  ctx.fillStyle = DOT_COLOR;
  const dr = s * (5 / 144);
  ctx.beginPath(); ctx.arc(s * (15 / 144), s * (129 / 144), dr, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * (90 / 144), s * (92 / 144), dr, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * (130 / 144), s * (14 / 144), dr, 0, Math.PI * 2); ctx.fill();
}

function drawInsideCorner(ctx: CanvasRenderingContext2D, s: number) {
  // Dark background
  ctx.fillStyle = TILE_FILL['inside-corner'];
  ctx.fillRect(0, 0, s, s);
  // Small red quarter-circle in top-left
  const r = s * (31 / 144);
  ctx.fillStyle = ACCENT_COLOR;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(r, 0);
  ctx.arc(0, 0, r, 0, Math.PI / 2);
  ctx.lineTo(0, r);
  ctx.closePath();
  ctx.fill();
  // Dot
  ctx.fillStyle = DOT_COLOR;
  const dr = s * (5 / 144);
  ctx.beginPath(); ctx.arc(s * (13 / 144), s * (13 / 144), dr, 0, Math.PI * 2); ctx.fill();
}

function drawInsideCorner45(ctx: CanvasRenderingContext2D, s: number) {
  // Dark background
  ctx.fillStyle = TILE_FILL['inside-corner-45'];
  ctx.fillRect(0, 0, s, s);
  // Small red triangle in top-left
  const r = s * (31 / 144);
  ctx.fillStyle = ACCENT_COLOR;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(r, 0);
  ctx.lineTo(0, r);
  ctx.closePath();
  ctx.fill();
  // Dot
  ctx.fillStyle = DOT_COLOR;
  const dr = s * (5 / 144);
  ctx.beginPath(); ctx.arc(s * (10 / 144), s * (9 / 144), dr, 0, Math.PI * 2); ctx.fill();
}

function drawBump(ctx: CanvasRenderingContext2D, s: number) {
  // Dark background
  ctx.fillStyle = TILE_FILL['bump'];
  ctx.fillRect(0, 0, s, s);
  // Lane strip along top edge
  const laneH = s * (31 / 144);
  ctx.fillStyle = LANE_COLOR;
  ctx.fillRect(0, 0, s, laneH);
  // Bump circle (extends above the top edge)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, s, s); // clip to tile boundary
  ctx.clip();
  ctx.fillStyle = LANE_COLOR;
  ctx.beginPath();
  ctx.arc(s * (72 / 144), s * (-7 / 144), s * (54 / 144), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Dots
  ctx.fillStyle = DOT_COLOR;
  const r = s * (4 / 144);
  ctx.beginPath(); ctx.arc(s * (14 / 144), s * (16 / 144), r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * (130 / 144), s * (16 / 144), r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * (72 / 144), s * (31 / 144), r, 0, Math.PI * 2); ctx.fill();
}

function drawDiagonal(ctx: CanvasRenderingContext2D, s: number) {
  // Background (the transparent lower-right triangle)
  ctx.fillStyle = CANVAS_BG_COLOR;
  ctx.fillRect(0, 0, s, s);
  // Dark upper-left triangle
  ctx.fillStyle = TILE_FILL['diagonal'];
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s, 0);
  ctx.lineTo(0, s);
  ctx.closePath();
  ctx.fill();
  // Red diagonal strip
  ctx.fillStyle = ACCENT_COLOR;
  ctx.beginPath();
  ctx.moveTo(s * (119.5 / 144), 0);
  ctx.lineTo(s, 0);
  ctx.lineTo(0, s);
  ctx.lineTo(0, s * (120 / 144));
  ctx.closePath();
  ctx.fill();
}

function drawBlank(ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = TILE_FILL['blank'];
  ctx.fillRect(0, 0, s, s);
}

const TILE_DRAW_FNS: Record<TileType, TileDrawFn> = {
  'straight': drawStraight,
  'corner': drawCorner,
  'inside-corner': drawInsideCorner,
  'inside-corner-45': drawInsideCorner45,
  'bump': drawBump,
  'diagonal': drawDiagonal,
  'blank': drawBlank,
};

/* ── Main render function ───────────────────────────────────────── */

export interface RenderThumbnailOptions {
  /** Record of placed tiles keyed by "x,y" */
  tiles: Record<string, PlacedTile>;
  /** Grid cell size in px (default: 288 from CELL_SIZE) */
  cellSize?: number;
  /** Output width (default: 260) */
  width?: number;
  /** Output height (default: 180) */
  height?: number;
}

/**
 * Renders a PNG thumbnail of the track layout using an offscreen canvas.
 * Returns a data:image/png base64 URL.
 *
 * Only draws tile shapes — no grid lines, selection highlights, or overlays.
 */
export function renderThumbnail({
  tiles,
  cellSize = 288,
  width = THUMB_W,
  height = THUMB_H,
}: RenderThumbnailOptions): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  const tileArr = Object.values(tiles);
  if (tileArr.length === 0) return canvas.toDataURL('image/png');

  const bbox = computeBoundingBox(tileArr);
  if (!bbox) return canvas.toDataURL('image/png');

  const fit = computeFit(bbox, cellSize, width, height);
  const tileScreenSize = cellSize * fit.scale;

  // Sort tiles by type so fill tiles draw first (behind drivable ones)
  const FILL_TYPES = new Set<TileType>(['blank', 'diagonal', 'inside-corner-45']);
  const sortedTiles = [...tileArr].sort((a, b) => {
    const aFill = FILL_TYPES.has(a.type) ? 0 : 1;
    const bFill = FILL_TYPES.has(b.type) ? 0 : 1;
    return aFill - bFill;
  });

  for (const tile of sortedTiles) {
    const drawFn = TILE_DRAW_FNS[tile.type];
    if (!drawFn) continue;

    // Position of this tile in the thumbnail
    const tx = fit.offsetX + (tile.x - bbox.minX) * tileScreenSize;
    const ty = fit.offsetY + (tile.y - bbox.minY) * tileScreenSize;

    ctx.save();

    // Subtle shadow under each tile
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 3 * fit.scale;
    ctx.shadowOffsetX = 1 * fit.scale;
    ctx.shadowOffsetY = 1 * fit.scale;

    // Move to tile center, rotate, then offset back so drawing is 0..size
    const cx = tx + tileScreenSize / 2;
    const cy = ty + tileScreenSize / 2;
    ctx.translate(cx, cy);
    ctx.rotate((tile.rotation * Math.PI) / 180);
    ctx.translate(-tileScreenSize / 2, -tileScreenSize / 2);

    // Turn off shadow after filling the base rect (avoid double-shadow on details)
    drawFn(ctx, tileScreenSize);

    ctx.restore();
  }

  // Thin border around the thumbnail for polish
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  return canvas.toDataURL('image/png');
}

/* ── Example usage (can be called from console or a React component) ─
 *
 *   import { renderThumbnail } from './lib/thumbnail-renderer';
 *
 *   // Sample tiles – a small L-shaped track
 *   const sampleTiles: Record<string, PlacedTile> = {
 *     '0,0': { type: 'corner',   x: 0, y: 0, rotation: 0 },
 *     '1,0': { type: 'straight', x: 1, y: 0, rotation: 0 },
 *     '2,0': { type: 'straight', x: 2, y: 0, rotation: 0 },
 *     '3,0': { type: 'corner',   x: 3, y: 0, rotation: 90 },
 *     '3,1': { type: 'straight', x: 3, y: 1, rotation: 90 },
 *     '3,2': { type: 'corner',   x: 3, y: 2, rotation: 180 },
 *     '2,2': { type: 'straight', x: 2, y: 2, rotation: 0 },
 *     '1,2': { type: 'straight', x: 1, y: 2, rotation: 0 },
 *     '0,2': { type: 'corner',   x: 0, y: 2, rotation: 270 },
 *     '0,1': { type: 'straight', x: 0, y: 1, rotation: 90 },
 *   };
 *
 *   const dataUrl = renderThumbnail({ tiles: sampleTiles });
 *   console.log(dataUrl); // "data:image/png;base64,..."
 *
 *   // Use in an <img>:
 *   // <img src={dataUrl} width={260} height={180} alt="Track thumbnail" />
 *
 * ──────────────────────────────────────────────────────────────────── */