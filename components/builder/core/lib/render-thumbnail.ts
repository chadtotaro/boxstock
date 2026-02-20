// components/builder/core/lib/render-thumbnail.ts
import type { PlacedTile } from '@/types/builder';
import { CELL_SIZE } from '@/types/builder';
import { toPng } from 'html-to-image';

export type ThumbnailOptions = {
  width: number;
  height: number;
  paddingCells?: number; // default 1
  showGrid?: boolean; // default true
  trackBg?: string; // default '#0b0f14'
  canvasBg?: string; // default '#0b0f14'
  pixelRatio?: number; // default 2
};

function boundsFromTiles(tiles: Record<string, PlacedTile>) {
  const arr = Object.values(tiles);
  if (arr.length === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const t of arr) {
    if (t.x < minX) minX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.x > maxX) maxX = t.x;
    if (t.y > maxY) maxY = t.y;
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Captures the real rendered DOM for the track layer.
 * Requires Canvas.tsx to have: <div id="TrackVisualLayer">...</div>
 */
export async function renderLayoutThumbnailDataUrl(
  tiles: Record<string, PlacedTile>,
  options: ThumbnailOptions
): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  const layer = document.getElementById('TrackVisualLayer') as HTMLElement | null;
  if (!layer) return null;

  const b = boundsFromTiles(tiles);
  const width = options.width;
  const height = options.height;

  const paddingCells = options.paddingCells ?? 1;
  const showGrid = options.showGrid ?? true;
  const trackBg = options.trackBg ?? '#0b0f14';
  const canvasBg = options.canvasBg ?? '#0b0f14';
  const pixelRatio = options.pixelRatio ?? 2;

  // Empty layout thumbnail
  if (!b) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(10, 10, width - 20, height - 20);
    return c.toDataURL('image/png');
  }

  // Crop region in tile-space (with padding)
  const minX = b.minX - paddingCells;
  const minY = b.minY - paddingCells;
  const maxX = b.maxX + paddingCells;
  const maxY = b.maxY + paddingCells;

  const cropW = (maxX - minX + 1) * CELL_SIZE;
  const cropH = (maxY - minY + 1) * CELL_SIZE;

  try {
    // Capture the REAL layer, cropped by translating it during capture.
    const rawPng = await toPng(layer, {
      cacheBust: true,
      pixelRatio,
      backgroundColor: trackBg,

      // output crop size (CSS px before pixelRatio)
      width: cropW,
      height: cropH,

      // shift so minX/minY becomes (0,0) in the capture
      style: {
        transform: `translate(${-minX * CELL_SIZE}px, ${-minY * CELL_SIZE}px)`,
        transformOrigin: 'top left',
        background: showGrid
          ? `
            linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px),
            ${trackBg}
          `
          : trackBg,
        backgroundSize: showGrid ? `${CELL_SIZE}px ${CELL_SIZE}px` : undefined,
        backgroundPosition: showGrid ? `0 0` : undefined,
      },
    });

    // Scale captured image into final thumbnail size (contain)
    const img = new Image();
    const scaled = await new Promise<string | null>((resolve) => {
      img.onload = () => {
        const out = document.createElement('canvas');
        out.width = width;
        out.height = height;
        const ctx = out.getContext('2d');
        if (!ctx) return resolve(null);

        ctx.fillStyle = canvasBg;
        ctx.fillRect(0, 0, width, height);

        const scale = Math.min(width / img.width, height / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const dx = (width - drawW) / 2;
        const dy = (height - drawH) / 2;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, dx, dy, drawW, drawH);

        resolve(out.toDataURL('image/png'));
      };

      img.onerror = () => resolve(null);
      img.src = rawPng;
    });

    return scaled;
  } catch (e) {
    console.warn('[thumb] capture failed', e);
    return null;
  }
}