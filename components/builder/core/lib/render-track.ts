import type { PlacedTile } from '@/types/builder';

export type RenderTheme = {
  background: string | null;     // null => transparent
  asphalt: string;
  shoulder: string;
  curb: string;
  gridLine: string;
  bolt: string;
};

export type RenderOptions = {
  cellPx: number;                // size of one tile cell in output pixels
  showGrid?: boolean;
  theme?: Partial<RenderTheme>;
};

/**
 * Minimal “track-like” renderer.
 * - Draws a tile base (shoulder + asphalt)
 * - Draws a lane/curve hint per tile type
 * - Adds curb accents + bolts so it doesn't read like tetris blocks
 *
 * This is intentionally simple + fast. Upgrade the visuals later without changing call sites.
 */
export function renderTrackToContext(
  ctx: CanvasRenderingContext2D,
  tiles: Record<string, PlacedTile>,
  opts: RenderOptions
) {
  const cell = opts.cellPx;
  const showGrid = opts.showGrid ?? true;

  const theme: RenderTheme = {
    background: '#ffffff',
    asphalt: '#0f1115',
    shoulder: '#ece7e7',
    curb: '#ff4b4b',
    gridLine: 'rgba(0,0,0,0.06)',
    bolt: 'rgba(0,0,0,0.55)',
    ...opts.theme,
  };

  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  // Background
  if (theme.background) {
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.clearRect(0, 0, W, H);
  }

  // Optional grid overlay (assumes caller already framed to a grid)
  if (showGrid) {
    ctx.save();
    ctx.strokeStyle = theme.gridLine;
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += cell) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += cell) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw tiles
  for (const t of Object.values(tiles)) {
    drawTile(ctx, t, cell, theme);
  }
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: PlacedTile,
  cell: number,
  theme: RenderTheme
) {
  const px = tile.x * cell;
  const py = tile.y * cell;
  const r = cell * 0.12;

  // Shoulder base
  ctx.fillStyle = theme.shoulder;
  roundedRect(ctx, px, py, cell, cell, r);
  ctx.fill();

  // Asphalt inset
  const inset = cell * 0.14;
  ctx.fillStyle = theme.asphalt;
  roundedRect(ctx, px + inset, py + inset, cell - inset * 2, cell - inset * 2, r * 0.9);
  ctx.fill();

  // Curb accents (simple red edges)
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = theme.curb;
  const curbW = cell * 0.06;
  // top + bottom curb strips
  roundedRect(ctx, px + inset, py + inset, cell - inset * 2, curbW, curbW);
  ctx.fill();
  roundedRect(ctx, px + inset, py + cell - inset - curbW, cell - inset * 2, curbW, curbW);
  ctx.fill();
  ctx.restore();

  // Bolt dots
  ctx.save();
  ctx.fillStyle = theme.bolt;
  ctx.globalAlpha = 0.35;
  const b = cell * 0.03;
  dot(ctx, px + cell * 0.18, py + cell * 0.18, b);
  dot(ctx, px + cell * 0.82, py + cell * 0.18, b);
  dot(ctx, px + cell * 0.18, py + cell * 0.82, b);
  dot(ctx, px + cell * 0.82, py + cell * 0.82, b);
  ctx.restore();

  // Lane hint (makes it read as “track path”, not blocks)
  ctx.save();
  ctx.translate(px + cell / 2, py + cell / 2);
  ctx.rotate(((tile.rotation ?? 0) * Math.PI) / 180);
  ctx.translate(-cell / 2, -cell / 2);

  const laneW = cell * 0.24;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = laneW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  switch (tile.type) {
    case 'straight': {
      ctx.moveTo(cell * 0.12, cell / 2);
      ctx.lineTo(cell * 0.88, cell / 2);
      break;
    }
    case 'corner':
    case 'inside-corner':
    case 'inside-corner-45': {
      ctx.arc(cell * 0.5, cell * 0.5, cell * 0.30, Math.PI, Math.PI * 1.5);
      break;
    }
    case 'diagonal': {
      ctx.moveTo(cell * 0.18, cell * 0.82);
      ctx.lineTo(cell * 0.82, cell * 0.18);
      break;
    }
    case 'bump': {
      ctx.moveTo(cell * 0.12, cell / 2);
      ctx.quadraticCurveTo(cell * 0.5, cell * 0.38, cell * 0.88, cell / 2);
      break;
    }
    case 'blank':
    default:
      break;
  }
  ctx.stroke();

  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}