import { useMemo } from 'react';
import type { PlacedTile, TileType } from '@/types/builder';
import { CELL_SIZE } from '@/types/builder';

interface MiniMapProps {
  tiles: Record<string, PlacedTile>;
  pan: { x: number; y: number };
  zoom: number;
  containerWidth: number;
  containerHeight: number;
}

const MINIMAP_SIZE = 140;
const TILE_COLORS: Record<TileType, string> = {
  'straight': '#EBE6E6',
  'corner': '#FE5757',
  'inside-corner': '#FE5757',
  'inside-corner-45': '#FE5757',
  'bump': '#EBE6E6',
  'diagonal': '#555B68',
  'blank': '#2A2E38',
};

const MIN_EXTENT = 10;

export function MiniMap({ tiles, pan, zoom, containerWidth, containerHeight }: MiniMapProps) {
  const tileEntries = useMemo(() => Object.values(tiles), [tiles]);

  const { worldLeft, worldTop, worldWidth, worldHeight, tileCount } = useMemo(() => {
    const viewL = -pan.x / zoom;
    const viewT = -pan.y / zoom;
    const viewR = (containerWidth - pan.x) / zoom;
    const viewB = (containerHeight - pan.y) / zoom;

    let minX = viewL, minY = viewT, maxX = viewR, maxY = viewB;

    for (const tile of tileEntries) {
      const tl = tile.x * CELL_SIZE;
      const tt = tile.y * CELL_SIZE;
      if (tl < minX) minX = tl;
      if (tt < minY) minY = tt;
      if (tl + CELL_SIZE > maxX) maxX = tl + CELL_SIZE;
      if (tt + CELL_SIZE > maxY) maxY = tt + CELL_SIZE;
    }

    minX -= CELL_SIZE;
    minY -= CELL_SIZE;
    maxX += CELL_SIZE;
    maxY += CELL_SIZE;

    const minWorldSize = MIN_EXTENT * CELL_SIZE;
    let ww = maxX - minX;
    let wh = maxY - minY;
    if (ww < minWorldSize) { const cx = (minX + maxX) / 2; minX = cx - minWorldSize / 2; ww = minWorldSize; }
    if (wh < minWorldSize) { const cy = (minY + maxY) / 2; minY = cy - minWorldSize / 2; wh = minWorldSize; }

    return { worldLeft: minX, worldTop: minY, worldWidth: ww, worldHeight: wh, tileCount: tileEntries.length };
  }, [tileEntries, pan, zoom, containerWidth, containerHeight]);

  const aspect = worldHeight / worldWidth;
  const miniWidth = aspect > 1 ? MINIMAP_SIZE / aspect : MINIMAP_SIZE;
  const miniHeight = aspect > 1 ? MINIMAP_SIZE : MINIMAP_SIZE * aspect;
  const scale = miniWidth / worldWidth;

  const viewL = -pan.x / zoom;
  const viewT = -pan.y / zoom;
  const viewW = containerWidth / zoom;
  const viewH = containerHeight / zoom;
  const vpX = (viewL - worldLeft) * scale;
  const vpY = (viewT - worldTop) * scale;
  const vpW = viewW * scale;
  const vpH = viewH * scale;

  return (
    <div
      className="absolute bottom-4 left-4 rounded-lg overflow-hidden"
      style={{
        backgroundColor: 'var(--c-minimap-bg)',
        border: '1px solid var(--c-border)',
        boxShadow: '0 4px 16px var(--c-shadow)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="flex items-center justify-between px-2.5 py-1.5"
        style={{ borderBottom: '1px solid var(--c-border)' }}
      >
        <span style={{ color: 'var(--c-text-muted)', fontSize: '9px', letterSpacing: '0.06em' }}>OVERVIEW</span>
        <span style={{ color: 'var(--c-text-dim)', fontSize: '9px' }}>{tileCount} tile{tileCount !== 1 ? 's' : ''}</span>
      </div>

      <div className="p-2">
        <svg width={miniWidth} height={miniHeight} viewBox={`0 0 ${miniWidth} ${miniHeight}`} className="block">
          <rect width={miniWidth} height={miniHeight} fill="var(--c-minimap-inner)" rx={2} />

          {Array.from({ length: 5 }).map((_, i) => {
            const x = ((i + 1) * miniWidth) / 5;
            return <line key={`mv-${i}`} x1={x} y1={0} x2={x} y2={miniHeight} stroke="var(--c-minimap-grid)" strokeWidth={0.5} />;
          })}
          {Array.from({ length: 5 }).map((_, i) => {
            const y = ((i + 1) * miniHeight) / 5;
            return <line key={`mh-${i}`} x1={0} y1={y} x2={miniWidth} y2={y} stroke="var(--c-minimap-grid)" strokeWidth={0.5} />;
          })}

          {(() => {
            const ox = (0 - worldLeft) * scale;
            const oy = (0 - worldTop) * scale;
            return (
              <>
                {ox >= 0 && ox <= miniWidth && <line x1={ox} y1={0} x2={ox} y2={miniHeight} stroke="var(--c-border)" strokeWidth={0.5} strokeDasharray="2 2" />}
                {oy >= 0 && oy <= miniHeight && <line x1={0} y1={oy} x2={miniWidth} y2={oy} stroke="var(--c-border)" strokeWidth={0.5} strokeDasharray="2 2" />}
              </>
            );
          })()}

          {tileEntries.map((tile) => {
            const x = (tile.x * CELL_SIZE - worldLeft) * scale;
            const y = (tile.y * CELL_SIZE - worldTop) * scale;
            const size = CELL_SIZE * scale;
            return (
              <rect
                key={`${tile.x},${tile.y}`}
                x={x + 0.5} y={y + 0.5}
                width={Math.max(size - 1, 1)} height={Math.max(size - 1, 1)}
                fill={TILE_COLORS[tile.type]} opacity={0.7} rx={1}
              />
            );
          })}

          <rect
            x={vpX} y={vpY} width={vpW} height={vpH}
            fill="var(--c-accent-bg-subtle)"
            stroke="var(--c-accent-border-strong)"
            strokeWidth={1} rx={1}
          />
        </svg>
      </div>
    </div>
  );
}