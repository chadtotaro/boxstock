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

import type { PlacedTile, TileType } from '@/types/builder';

/* ── Configuration ──────────────────────────────────────────────── */

const THUMB_W = 260;
const THUMB_H = 180;
const PADDING = 20; // px around the bounding box
const BG_COLOR = '#0b0f14';

// Per-tile-type fill colors – matches the visual style from TileRenderer
const TILE_FILL: Record<TileType, string> = {
  'straight': '#161920',
  'corner': '#161920',
  'inside-corner': '#161920',
  'inside-corner-45': '#161920',
  'bump': '#161920',
  'diagonal': '#161920',
  'blank': '#3A3F4C',
};

// Accent colors used within tile shapes (lane strip, corner arc, etc.)
const LANE_COLOR = '#4a5268';
const ACCENT_COLOR = '#FE5757';
const DOT_COLOR = '#1e2330';
const CANVAS_BG_COLOR = '#0b0f14'; // for transparent parts of corner / diagonal

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

/* ── Individual tile draw functions ────────────────────────────── */

type TileDrawFn = (ctx: CanvasRenderingContext2D, s: number, simple?: boolean) => void;

function drawStraight(ctx: CanvasRenderingContext2D, s: number, simple = false) {
  ctx.fillStyle = TILE_FILL['straight'];
  ctx.fillRect(0, 0, s, s);
  if (simple) return;
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

function drawCorner(ctx: CanvasRenderingContext2D, s: number, simple = false) {
  // Background
  ctx.fillStyle = CANVAS_BG_COLOR;
  ctx.fillRect(0, 0, s, s);
  // Outer red arc
  ctx.fillStyle = ACCENT_COLOR;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s, 0);
  ctx.arcTo(s, s, 0, s, s);
  ctx.lineTo(0, s);
  ctx.closePath();
  ctx.fill();
  // Inner dark arc
  const innerS = s * (116 / 144);
  ctx.fillStyle = TILE_FILL['corner'];
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(innerS, 0);
  ctx.arcTo(innerS, innerS, 0, innerS, innerS);
  ctx.lineTo(0, innerS);
  ctx.closePath();
  ctx.fill();
  if (simple) return;
  // Dots
  ctx.fillStyle = DOT_COLOR;
  const dr = s * (5 / 144);
  ctx.beginPath(); ctx.arc(s * (15 / 144), s * (129 / 144), dr, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * (90 / 144), s * (92 / 144), dr, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * (130 / 144), s * (14 / 144), dr, 0, Math.PI * 2); ctx.fill();
}

function drawInsideCorner(ctx: CanvasRenderingContext2D, s: number, simple = false) {
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
  if (simple) return;
  // Dot
  ctx.fillStyle = DOT_COLOR;
  const dr = s * (5 / 144);
  ctx.beginPath(); ctx.arc(s * (13 / 144), s * (13 / 144), dr, 0, Math.PI * 2); ctx.fill();
}

function drawInsideCorner45(ctx: CanvasRenderingContext2D, s: number, simple = false) {
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
  if (simple) return;
  // Dot
  ctx.fillStyle = DOT_COLOR;
  const dr = s * (5 / 144);
  ctx.beginPath(); ctx.arc(s * (10 / 144), s * (9 / 144), dr, 0, Math.PI * 2); ctx.fill();
}

function drawBump(ctx: CanvasRenderingContext2D, s: number, simple = false) {
  ctx.fillStyle = TILE_FILL['bump'];
  ctx.fillRect(0, 0, s, s);
  if (simple) return;
  // Lane strip along top edge
  const laneH = s * (31 / 144);
  ctx.fillStyle = LANE_COLOR;
  ctx.fillRect(0, 0, s, laneH);
  // Bump circle
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, s, s);
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

function drawDiagonal(ctx: CanvasRenderingContext2D, s: number, simple = false) {
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
  if (simple) return;
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
  tiles: Record<string, PlacedTile>;
  cellSize?: number;
  width?: number;
  height?: number;
}

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

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  const tileArr = Object.values(tiles);
  if (tileArr.length === 0) return canvas.toDataURL('image/png');

  const bbox = computeBoundingBox(tileArr);
  if (!bbox) return canvas.toDataURL('image/png');

  const fit = computeFit(bbox, cellSize, width, height);
  const tileScreenSize = cellSize * fit.scale;

  // Below 12px per tile, skip internal details — just draw solid shapes
  const simpleMode = tileScreenSize < 12;

  const FILL_TYPES = new Set<TileType>(['blank', 'diagonal', 'inside-corner-45']);
  const sortedTiles = [...tileArr].sort((a, b) => {
    const aFill = FILL_TYPES.has(a.type) ? 0 : 1;
    const bFill = FILL_TYPES.has(b.type) ? 0 : 1;
    return aFill - bFill;
  });

  for (const tile of sortedTiles) {
    const drawFn = TILE_DRAW_FNS[tile.type];
    if (!drawFn) continue;

    const tx = fit.offsetX + (tile.x - bbox.minX) * tileScreenSize;
    const ty = fit.offsetY + (tile.y - bbox.minY) * tileScreenSize;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 3 * fit.scale;
    ctx.shadowOffsetX = 1 * fit.scale;
    ctx.shadowOffsetY = 1 * fit.scale;

    const cx = tx + tileScreenSize / 2;
    const cy = ty + tileScreenSize / 2;
    ctx.translate(cx, cy);
    ctx.rotate((tile.rotation * Math.PI) / 180);
    ctx.translate(-tileScreenSize / 2, -tileScreenSize / 2);

    drawFn(ctx, tileScreenSize, simpleMode);
    ctx.restore();
  }

  // Thin border for polish
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  return canvas.toDataURL('image/png');
}