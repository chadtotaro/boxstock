/**
 * spiral-placer.ts
 *
 * Deterministic inventory placement tool.  Takes a tile inventory
 * (counts per type) and places them onto the grid starting from
 * the center and growing outward in a spiral pattern.
 *
 * Spiral order:
 *   right 1 → down 1 → left 2 → up 2 → right 3 → down 3 → …
 */

import { TILE_ORDER } from '@/data/tile-data';
import type { PlacedTile, TileType } from '@/types/builder';

/* ── Spiral coordinate generator ─────────────────────────────────── */

/**
 * Yields grid coordinates in a center-out spiral starting at (cx, cy).
 *
 * Pattern: center, right 1, down 1, left 2, up 2, right 3, down 3, …
 */
function* spiralCoords(cx: number, cy: number): Generator<{ x: number; y: number }> {
  yield { x: cx, y: cy };

  let x = cx;
  let y = cy;
  let step = 1;

  while (true) {
    // right `step`
    for (let i = 0; i < step; i++) { x++; yield { x, y }; }
    // down `step`
    for (let i = 0; i < step; i++) { y++; yield { x, y }; }
    step++;
    // left `step`
    for (let i = 0; i < step; i++) { x--; yield { x, y }; }
    // up `step`
    for (let i = 0; i < step; i++) { y--; yield { x, y }; }
    step++;
  }
}

/* ── Main placement function ─────────────────────────────────────── */

export interface PlaceInventoryResult {
  /** New tiles to merge into the existing tile record */
  newTiles: Record<string, PlacedTile>;
  /** Total number of tiles placed */
  count: number;
}

/**
 * Places all tiles from the inventory onto the grid in a center-out
 * spiral, skipping any cells already occupied.
 *
 * @param inventory   Counts per tile type
 * @param existing    Currently placed tiles (will not be overwritten)
 * @param centerX     Grid center X (default 0)
 * @param centerY     Grid center Y (default 0)
 */
export function placeInventoryOnCanvas(
  inventory: Record<TileType, number>,
  existing: Record<string, PlacedTile>,
  centerX: number = 0,
  centerY: number = 0,
): PlaceInventoryResult {
  // Build the list of tiles to place, in TILE_ORDER
  const tilesToPlace: TileType[] = [];
  for (const tileType of TILE_ORDER) {
    const count = inventory[tileType] ?? 0;
    for (let i = 0; i < count; i++) {
      tilesToPlace.push(tileType);
    }
  }

  if (tilesToPlace.length === 0) {
    return { newTiles: {}, count: 0 };
  }

  // Merge existing keys into an occupied set
  const occupied = new Set<string>(Object.keys(existing));

  const newTiles: Record<string, PlacedTile> = {};
  const spiral = spiralCoords(centerX, centerY);
  let placed = 0;

  for (const tileType of tilesToPlace) {
    // Find next empty cell in spiral order
    let cell = spiral.next().value!;
    let key = `${cell.x},${cell.y}`;

    while (occupied.has(key)) {
      cell = spiral.next().value!;
      key = `${cell.x},${cell.y}`;
    }

    newTiles[key] = {
      type: tileType,
      x: cell.x,
      y: cell.y,
      rotation: 0,
      source: 'inventoryDump',
    };
    occupied.add(key);
    placed++;
  }

  return { newTiles, count: placed };
}
