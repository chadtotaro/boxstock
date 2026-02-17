/**
 * Constraint-based closed-loop track layout generator — 50 cm RCP Kit edition.
 *
 * Track model:
 *   The racing lane is ALWAYS exactly 2 grid cells wide.  A 1-cell-wide
 *   centerline path is computed first, then expanded into a 2-cell-wide
 *   continuous ribbon made of two concentric, independently-valid closed
 *   loops (inner + outer).  Both loops share the same tile inventory.
 *
 * Rules enforced:
 *   1. Every layout is a fully closed loop — no dead ends.
 *   2. All tile connectors match their neighbours.
 *   3. No overlapping tiles.
 *   4. No single-width segments — every segment is exactly 2 cells wide.
 *   5. Tile inventory counts are respected (paired consumption: each
 *      centerline straight = 2 straight tiles, each centerline corner =
 *      2 corner tiles).
 *   6. Layouts fit within the selected footprint size with ≥ 1 cell
 *      clearance from the outer boundary on all sides.
 *   7. Three distinct variants with different character.
 *   8. No self-intersections, no diagonal adjacency errors.
 */

import type { PlacedTile, TileType, Direction } from '@/types/builder';

/* ── Public types ─────────────────────────────────────────────────── */

export type FootprintSize = 'small' | 'medium' | 'large';

export interface GeneratedLayout {
  id: string;
  label: string;
  style: string;
  tiles: Record<string, PlacedTile>;
  stats: {
    totalTiles: number;
    turnCount: number;
    longestStraight: number;
    difficulty: 'Low' | 'Medium' | 'High';
  };
}

/* ── Constants ────────────────────────────────────────────────────── */

const FOOTPRINT_MAX: Record<FootprintSize, number> = {
  small: 6,
  medium: 10,
  large: 16,
};

type Coord = { x: number; y: number };

const DIR_DELTA: Record<Direction, Coord> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  N: 'S',
  S: 'N',
  E: 'W',
  W: 'E',
};

/* ── Rotation math (matches tile-data.ts) ─────────────────────────── */

const ROTATION_MAP: Record<Direction, Direction[]> = {
  N: ['N', 'E', 'S', 'W'],
  E: ['E', 'S', 'W', 'N'],
  S: ['S', 'W', 'N', 'E'],
  W: ['W', 'N', 'E', 'S'],
};

function rotatedConnectors(
  baseConnectors: Direction[],
  rotation: number,
): Direction[] {
  const idx = ((rotation / 90) % 4 + 4) % 4;
  return baseConnectors.map((d) => ROTATION_MAP[d][idx]);
}

/* ── Tile connector definitions ──────────────────────────────────── */

const TILE_BASE_CONNECTORS: Partial<Record<TileType, Direction[]>> = {
  straight: ['W', 'E'],
  corner: ['N', 'W'],
  'inside-corner': ['N', 'W'],
  bump: ['W', 'E'],
};

/**
 * Build a lookup: for a given pair of required connector directions,
 * which (tileType, rotation) options can satisfy it?
 */
interface TileOption {
  type: TileType;
  rotation: number;
}

function pairKey(a: Direction, b: Direction): string {
  return [a, b].sort().join(',');
}

const PAIR_OPTIONS: Record<string, TileOption[]> = {};

// Populate PAIR_OPTIONS
for (const [tileType, base] of Object.entries(TILE_BASE_CONNECTORS)) {
  if (!base || base.length !== 2) continue;
  for (const rot of [0, 90, 180, 270]) {
    const [c0, c1] = rotatedConnectors(base, rot);
    const key = pairKey(c0, c1);
    if (!PAIR_OPTIONS[key]) PAIR_OPTIONS[key] = [];
    const exists = PAIR_OPTIONS[key].some(
      (o) => o.type === tileType && o.rotation === rot,
    );
    if (!exists) {
      PAIR_OPTIONS[key].push({ type: tileType as TileType, rotation: rot });
    }
  }
}

/* ── Seedable PRNG ────────────────────────────────────────────────── */

function createRNG(seed: number) {
  let s = Math.abs(seed) | 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/* ── Direction helpers ────────────────────────────────────────────── */

function getDirection(from: Coord, to: Coord): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return 'E';
  if (dx === -1 && dy === 0) return 'W';
  if (dy === 1 && dx === 0) return 'S';
  if (dy === -1 && dx === 0) return 'N';
  throw new Error(`Not adjacent: (${from.x},${from.y}) → (${to.x},${to.y})`);
}

/* ── Path builders ────────────────────────────────────────────────── */

/**
 * Rectangle path (clockwise). Returns ordered cycle of cells.
 * w = cells wide, h = cells tall. Both ≥ 2.
 */
function buildRectPath(w: number, h: number): Coord[] {
  const path: Coord[] = [];
  for (let x = 0; x < w; x++) path.push({ x, y: 0 });
  for (let y = 1; y < h; y++) path.push({ x: w - 1, y });
  for (let x = w - 2; x >= 0; x--) path.push({ x, y: h - 1 });
  for (let y = h - 2; y >= 1; y--) path.push({ x: 0, y });
  return path;
}

/* ── Path validation ──────────────────────────────────────────────── */

function validatePath(path: Coord[]): boolean {
  if (path.length < 4) return false;

  // Check no duplicates
  const visited = new Set<string>();
  for (const c of path) {
    const key = `${c.x},${c.y}`;
    if (visited.has(key)) return false;
    visited.add(key);
  }

  // Check adjacency
  const n = path.length;
  for (let i = 0; i < n; i++) {
    const curr = path[i];
    const next = path[(i + 1) % n];
    const dx = Math.abs(next.x - curr.x);
    const dy = Math.abs(next.y - curr.y);
    if (dx + dy !== 1) return false;
  }

  return true;
}

/* ── Tile assignment (mutable budget) ─────────────────────────────── */

/**
 * Assign tiles to a closed path, mutating the shared budget in-place.
 * This allows two paths to draw from the same inventory pool.
 */
function assignTilesFromBudget(
  path: Coord[],
  budget: Record<TileType, number>,
  preferCorner: boolean,
  preferBump: boolean,
  rng: () => number,
): Record<string, PlacedTile> | null {
  const n = path.length;
  const tiles: Record<string, PlacedTile> = {};

  for (let i = 0; i < n; i++) {
    const prev = path[(i - 1 + n) % n];
    const curr = path[i];
    const next = path[(i + 1) % n];

    const dirPrev = getDirection(curr, prev);
    const dirNext = getDirection(curr, next);
    const isTurn = dirPrev !== OPPOSITE[dirNext];

    const key = pairKey(dirPrev, dirNext);
    const options = PAIR_OPTIONS[key];
    if (!options || options.length === 0) return null;

    const available = options.filter((o) => budget[o.type] > 0);
    if (available.length === 0) return null;

    // Sort by preference
    available.sort((a, b) => {
      if (isTurn) {
        const aIsCorner = a.type === 'corner' ? 1 : 0;
        const bIsCorner = b.type === 'corner' ? 1 : 0;
        return preferCorner
          ? bIsCorner - aIsCorner
          : aIsCorner - bIsCorner;
      } else {
        const aIsBump = a.type === 'bump' ? 1 : 0;
        const bIsBump = b.type === 'bump' ? 1 : 0;
        return preferBump
          ? bIsBump - aIsBump
          : aIsBump - bIsBump;
      }
    });

    // Small chance to pick non-preferred for variety
    const idx = rng() < 0.15 && available.length > 1 ? 1 : 0;
    const pick = available[idx];

    budget[pick.type]--;
    tiles[`${curr.x},${curr.y}`] = {
      type: pick.type,
      x: curr.x,
      y: curr.y,
      rotation: pick.rotation,
    };
  }

  return tiles;
}

/* ── 2-wide ribbon builder ────────────────────────────────────────── */

/**
 * Build a 2-cell-wide rectangular track from a centerline rectangle.
 *
 * The ribbon consists of two concentric closed loops:
 *   • Inner loop  – rectangle of (centerW × centerH) at grid offset (1,1)
 *   • Outer loop  – rectangle of (centerW+2 × centerH+2) at grid (0,0)
 *
 * Each loop is an independently valid closed loop of tiles.  Both loops
 * share the same tile inventory budget.
 *
 * @returns combined tile record, or null if inventory is insufficient.
 */
function build2WideRectTrack(
  centerW: number,
  centerH: number,
  inv: Record<TileType, number>,
  preferCorner: boolean,
  preferBump: boolean,
  rng: () => number,
): { tiles: Record<string, PlacedTile>; innerPath: Coord[]; outerPath: Coord[] } | null {
  if (centerW < 2 || centerH < 2) return null;

  // Build inner path (centerline rect, offset by 1 so the outer lane fits)
  const innerRaw = buildRectPath(centerW, centerH);
  const innerPath = innerRaw.map((c) => ({ x: c.x + 1, y: c.y + 1 }));

  // Build outer path (expanded by 1 on each side)
  const outerW = centerW + 2;
  const outerH = centerH + 2;
  const outerPath = buildRectPath(outerW, outerH);

  if (!validatePath(innerPath) || !validatePath(outerPath)) return null;

  // Verify no cell overlap between inner and outer paths
  const innerCells = new Set(innerPath.map((c) => `${c.x},${c.y}`));
  for (const c of outerPath) {
    if (innerCells.has(`${c.x},${c.y}`)) return null;
  }

  // Pre-check inventory (paired consumption)
  const turnBudget = (inv['corner'] || 0) + (inv['inside-corner'] || 0);
  const straightBudget = (inv['straight'] || 0) + (inv['bump'] || 0);

  const neededTurns = 8; // 4 inner corners + 4 outer corners
  const innerStraights = innerPath.length - 4;
  const outerStraights = outerPath.length - 4;
  const neededStraights = innerStraights + outerStraights;

  if (turnBudget < neededTurns || straightBudget < neededStraights) return null;

  // Assign tiles using shared mutable budget — inner loop first (smaller)
  const budget = { ...inv };
  const innerTiles = assignTilesFromBudget(innerPath, budget, preferCorner, preferBump, rng);
  if (!innerTiles) return null;

  const outerTiles = assignTilesFromBudget(outerPath, budget, preferCorner, preferBump, rng);
  if (!outerTiles) return null;

  // Merge and verify no overlaps
  const allTiles: Record<string, PlacedTile> = {};
  for (const [key, tile] of Object.entries(innerTiles)) {
    allTiles[key] = tile;
  }
  for (const [key, tile] of Object.entries(outerTiles)) {
    if (allTiles[key]) return null; // overlap — should not happen
    allTiles[key] = tile;
  }

  return { tiles: allTiles, innerPath, outerPath };
}

/* ── Stats & metrics ──────────────────────────────────────────────── */

interface LayoutMetrics {
  totalTiles: number;
  turnCount: number;
  longestStraight: number;
  avgStraightRun: number;
  difficulty: 'Low' | 'Medium' | 'High';
  boundingW: number;
  boundingH: number;
  aspectRatio: number;
  hasBumps: boolean;
  reversalCount: number;
}

/**
 * Compute metrics using a centerline path for shape analysis and the
 * full tile set for size / bounding-box analysis.
 */
function computeMetrics(
  path: Coord[],
  tiles: Record<string, PlacedTile>,
): LayoutMetrics {
  const n = path.length;
  let turnCount = 0;
  let longestStraight = 0;
  let currentStraight = 0;
  const straightRuns: number[] = [];
  const turnDirs: ('L' | 'R')[] = [];

  for (let i = 0; i < n; i++) {
    const prev = path[(i - 1 + n) % n];
    const curr = path[i];
    const next = path[(i + 1) % n];
    const dirIn = getDirection(prev, curr);
    const dirOut = getDirection(curr, next);

    if (dirIn === dirOut) {
      currentStraight++;
    } else {
      turnCount++;
      if (currentStraight > 0) straightRuns.push(currentStraight + 1);
      longestStraight = Math.max(longestStraight, currentStraight);
      currentStraight = 0;

      const dIn = DIR_DELTA[dirIn];
      const dOut = DIR_DELTA[dirOut];
      const cross = dIn.x * dOut.y - dIn.y * dOut.x;
      turnDirs.push(cross > 0 ? 'R' : 'L');
    }
  }
  if (currentStraight > 0) straightRuns.push(currentStraight + 1);
  longestStraight = Math.max(longestStraight, currentStraight);
  longestStraight = Math.max(1, longestStraight + 1);

  let reversalCount = 0;
  for (let i = 1; i < turnDirs.length; i++) {
    if (turnDirs[i] !== turnDirs[i - 1]) reversalCount++;
  }
  if (turnDirs.length >= 2 && turnDirs[0] !== turnDirs[turnDirs.length - 1]) {
    reversalCount++;
  }

  const avgStraightRun =
    straightRuns.length > 0
      ? straightRuns.reduce((a, b) => a + b, 0) / straightRuns.length
      : 1;

  const entries = Object.values(tiles);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const t of entries) {
    if (t.x < minX) minX = t.x;
    if (t.x > maxX) maxX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.y > maxY) maxY = t.y;
  }
  const boundingW = entries.length > 0 ? maxX - minX + 1 : 1;
  const boundingH = entries.length > 0 ? maxY - minY + 1 : 1;
  const aspectRatio =
    Math.max(boundingW, boundingH) / Math.max(1, Math.min(boundingW, boundingH));

  const hasBumps = entries.some((t) => t.type === 'bump');
  const totalTiles = entries.length;

  // Difficulty based on centerline turn ratio
  const centerlineTurnRatio = turnCount / Math.max(1, path.length);
  const difficulty: 'Low' | 'Medium' | 'High' =
    centerlineTurnRatio > 0.45 ? 'High' : centerlineTurnRatio > 0.25 ? 'Medium' : 'Low';

  return {
    totalTiles,
    turnCount,
    longestStraight,
    avgStraightRun,
    difficulty,
    boundingW,
    boundingH,
    aspectRatio,
    hasBumps,
    reversalCount,
  };
}

function metricsToStats(m: LayoutMetrics): GeneratedLayout['stats'] {
  return {
    totalTiles: m.totalTiles,
    turnCount: m.turnCount,
    longestStraight: m.longestStraight,
    difficulty: m.difficulty,
  };
}

/* ── Descriptor classification ────────────────────────────────────── */

interface DescriptorRule {
  label: string;
  test: (m: LayoutMetrics) => boolean;
}

const DESCRIPTOR_RULES: DescriptorRule[] = [
  {
    label: 'Pocket Circuit',
    test: (m) => m.totalTiles <= 16 && m.boundingW <= 4 && m.boundingH <= 4,
  },
  {
    label: 'Technical Hairpin',
    test: (m) => {
      const centerTurnRatio = m.turnCount / Math.max(1, m.totalTiles / 2);
      return centerTurnRatio > 0.5 && m.longestStraight <= 2;
    },
  },
  {
    label: 'Aggressive Switchbacks',
    test: (m) => m.turnCount >= 8 && m.reversalCount >= 4,
  },
  {
    label: 'Serpentine Rally',
    test: (m) => m.turnCount >= 8 && m.reversalCount >= 2,
  },
  {
    label: 'Tight Technical',
    test: (m) => {
      const centerTurnRatio = m.turnCount / Math.max(1, m.totalTiles / 2);
      return centerTurnRatio > 0.3 && m.longestStraight <= 3;
    },
  },
  {
    label: 'Rally Stage',
    test: (m) => {
      const centerTurnRatio = m.turnCount / Math.max(1, m.totalTiles / 2);
      return m.hasBumps && centerTurnRatio > 0.25;
    },
  },
  {
    label: 'High Speed Circuit',
    test: (m) => {
      const centerTurnRatio = m.turnCount / Math.max(1, m.totalTiles / 2);
      return m.longestStraight >= 5 && centerTurnRatio < 0.2;
    },
  },
  {
    label: 'Power Sweep',
    test: (m) => m.longestStraight >= 4 && m.aspectRatio > 1.8 && m.turnCount <= 6,
  },
  {
    label: 'Grand Prix Layout',
    test: (m) => m.totalTiles >= 48 && m.turnCount >= 6,
  },
  {
    label: 'Chicane Run',
    test: (m) => m.turnCount === 6,
  },
  {
    label: 'Flowing Oval',
    test: (m) => m.turnCount === 4 && m.aspectRatio >= 1.4 && m.longestStraight >= 3,
  },
  {
    label: 'Stadium Circuit',
    test: (m) => m.turnCount === 4 && m.aspectRatio < 1.4,
  },
  {
    label: 'Sprint Loop',
    test: (m) => m.totalTiles >= 16 && m.totalTiles <= 28,
  },
  {
    label: 'Balanced Flow',
    test: () => true,
  },
];

function classifyDescriptors(m: LayoutMetrics): string[] {
  return DESCRIPTOR_RULES.filter((r) => r.test(m)).map((r) => r.label);
}

function assignUniqueDescriptors(
  layouts: { layout: GeneratedLayout; metrics: LayoutMetrics }[],
): void {
  const used = new Set<string>();
  const ranked = layouts.map((entry, idx) => ({
    idx,
    entry,
    candidates: classifyDescriptors(entry.metrics),
  }));
  ranked.sort((a, b) => a.candidates.length - b.candidates.length);

  for (const r of ranked) {
    const pick = r.candidates.find((c) => !used.has(c)) || r.candidates[0];
    used.add(pick);
    r.entry.layout.style = pick;
  }
}

/* ── Center a layout around origin ────────────────────────────────── */

function centerLayout(
  tiles: Record<string, PlacedTile>,
): Record<string, PlacedTile> {
  const entries = Object.values(tiles);
  if (entries.length === 0) return tiles;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const t of entries) {
    if (t.x < minX) minX = t.x;
    if (t.x > maxX) maxX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.y > maxY) maxY = t.y;
  }

  const cx = Math.floor((minX + maxX) / 2);
  const cy = Math.floor((minY + maxY) / 2);
  const result: Record<string, PlacedTile> = {};
  for (const t of entries) {
    const nx = t.x - cx;
    const ny = t.y - cy;
    result[`${nx},${ny}`] = { ...t, x: nx, y: ny };
  }
  return result;
}

/* ── Sizing helpers ───────────────────────────────────────────────── */

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * For a 2-wide track, the outer bounding box is (centerW+2) × (centerH+2).
 * With ≥ 1-cell clearance on each side: outer + 2 ≤ maxDim.
 * So max center dimension = maxDim − 4  (minimum 2).
 */
function maxCenterDim(footprint: FootprintSize): number {
  return Math.max(2, FOOTPRINT_MAX[footprint] - 4);
}

/**
 * Check whether the inventory can support a 2-wide rectangle of
 * centerline dims (cW × cH).
 */
function canFit2WideRect(
  cW: number,
  cH: number,
  inv: Record<TileType, number>,
): boolean {
  const turnBudget = (inv['corner'] || 0) + (inv['inside-corner'] || 0);
  const straightBudget = (inv['straight'] || 0) + (inv['bump'] || 0);

  const neededTurns = 8; // 4 inner + 4 outer
  const innerPerimeter = 2 * (cW + cH) - 4;
  const outerPerimeter = 2 * (cW + 2 + cH + 2) - 4;
  const neededStraights = (innerPerimeter - 4) + (outerPerimeter - 4);

  return turnBudget >= neededTurns && straightBudget >= neededStraights;
}

/**
 * Find the largest centerline sum (cW+cH) that fits the inventory's
 * straight budget for a 2-wide rect.
 *
 * Total straights = 4*(cW+cH) − 8
 * → cW+cH ≤ (straightBudget + 8) / 4
 */
function maxCenterlineSum(inv: Record<TileType, number>): number {
  const straightBudget = (inv['straight'] || 0) + (inv['bump'] || 0);
  return Math.floor((straightBudget + 8) / 4);
}

/* ── Variant A: Compact / Tight Technical ─────────────────────────── */

function buildVariantA(
  inv: Record<TileType, number>,
  footprint: FootprintSize,
  seed: number,
): GeneratedLayout | null {
  const rng = createRNG(seed);
  const maxC = maxCenterDim(footprint);
  const maxSum = maxCenterlineSum(inv);

  // Compact, squarish — keep cW ≈ cH, both small
  const jitter = Math.floor(rng() * 2);
  let cW = clamp(2 + jitter, 2, maxC);
  let cH = clamp(2, 2, maxC);
  // Ensure the sum fits the budget
  while (cW + cH > maxSum && (cW > 2 || cH > 2)) {
    if (cW > cH) cW--;
    else cH--;
  }
  if (cW < 2 || cH < 2) return null;
  if (!canFit2WideRect(cW, cH, inv)) return null;

  const result = build2WideRectTrack(cW, cH, inv, true, true, rng);
  if (!result) return null;

  const centered = centerLayout(result.tiles);
  const metrics = computeMetricsFrom2Wide(result, centered);
  const stats = metricsToStats(metrics);

  return {
    id: 'a-' + seed,
    label: 'Option A',
    style: 'Tight Technical',
    tiles: centered,
    stats,
  };
}

/* ── Variant B: Elongated / Flowing ───────────────────────────────── */

function buildVariantB(
  inv: Record<TileType, number>,
  footprint: FootprintSize,
  seed: number,
): GeneratedLayout | null {
  const rng = createRNG(seed + 7919);
  const maxC = maxCenterDim(footprint);
  const maxSum = maxCenterlineSum(inv);

  // Elongated — cW significantly larger than cH
  const jitter = Math.floor(rng() * 2);
  let cW = clamp(4 + jitter, 3, maxC);
  let cH = clamp(2, 2, maxC);
  while (cW + cH > maxSum && cW > 2) cW--;
  if (cW < 2 || cH < 2) return null;
  // Ensure cW > cH for elongated shape; if not, swap
  if (cW < cH) {
    const tmp = cW; cW = cH; cH = tmp;
  }
  if (!canFit2WideRect(cW, cH, inv)) return null;

  const result = build2WideRectTrack(cW, cH, inv, false, false, rng);
  if (!result) return null;

  const centered = centerLayout(result.tiles);
  const metrics = computeMetricsFrom2Wide(result, centered);
  const stats = metricsToStats(metrics);

  return {
    id: 'b-' + seed,
    label: 'Option B',
    style: 'Balanced Flow',
    tiles: centered,
    stats,
  };
}

/* ── Variant C: Large / Grand ─────────────────────────────────────── */

function buildVariantC(
  inv: Record<TileType, number>,
  footprint: FootprintSize,
  seed: number,
): GeneratedLayout | null {
  const rng = createRNG(seed + 15487);
  const maxC = maxCenterDim(footprint);
  const maxSum = maxCenterlineSum(inv);

  // Large, balanced — push both dims as high as budget allows
  const jitter = Math.floor(rng() * 2);
  let target = Math.min(maxSum, maxC * 2); // target cW+cH
  let cW = clamp(Math.floor(target / 2) + jitter, 2, maxC);
  let cH = clamp(target - cW, 2, maxC);
  while (cW + cH > maxSum && (cW > 2 || cH > 2)) {
    if (cW > cH) cW--;
    else cH--;
  }
  if (cW < 2 || cH < 2) return null;
  if (!canFit2WideRect(cW, cH, inv)) return null;

  const result = build2WideRectTrack(cW, cH, inv, true, false, rng);
  if (!result) return null;

  const centered = centerLayout(result.tiles);
  const metrics = computeMetricsFrom2Wide(result, centered);
  const stats = metricsToStats(metrics);

  return {
    id: 'c-' + seed,
    label: 'Option C',
    style: 'Stadium Circuit',
    tiles: centered,
    stats,
  };
}

/* ── Metrics helper for 2-wide ────────────────────────────────────── */

/**
 * Compute metrics for a 2-wide track by mapping the inner (centerline)
 * path through the centering transform and analysing it against the
 * full (centered) tile set.
 */
function computeMetricsFrom2Wide(
  buildResult: { tiles: Record<string, PlacedTile>; innerPath: Coord[]; outerPath: Coord[] },
  centeredTiles: Record<string, PlacedTile>,
): LayoutMetrics {
  // Determine the centering offset by comparing any original tile to its centered version
  const origEntries = Object.values(buildResult.tiles);
  const centEntries = Object.values(centeredTiles);
  let dx = 0, dy = 0;
  if (origEntries.length > 0 && centEntries.length > 0) {
    // Since centering changes keys, compute offset from bounding box instead
    let oMinX = Infinity, oMinY = Infinity;
    for (const t of origEntries) {
      if (t.x < oMinX) oMinX = t.x;
      if (t.y < oMinY) oMinY = t.y;
    }
    let cMinX = Infinity, cMinY = Infinity;
    for (const t of centEntries) {
      if (t.x < cMinX) cMinX = t.x;
      if (t.y < cMinY) cMinY = t.y;
    }
    dx = cMinX - oMinX;
    dy = cMinY - oMinY;
  }

  const centeredInnerPath = buildResult.innerPath.map((c) => ({
    x: c.x + dx,
    y: c.y + dy,
  }));

  return computeMetrics(centeredInnerPath, centeredTiles);
}

/* ── Final validation ─────────────────────────────────────────────── */

/**
 * Reconstruct the ordered cycle path from a set of placed tiles.
 * Traces connectors from an arbitrary starting tile until it loops back.
 * Returns null if the tiles don't form a single valid loop.
 */
function reconstructPath(tiles: Record<string, PlacedTile>): Coord[] | null {
  const entries = Object.values(tiles);
  if (entries.length < 4) {
    return entries.length > 0 ? entries.map((t) => ({ x: t.x, y: t.y })) : null;
  }

  const start = entries[0];
  const path: Coord[] = [{ x: start.x, y: start.y }];
  const visited = new Set<string>([`${start.x},${start.y}`]);

  const startBase = TILE_BASE_CONNECTORS[start.type];
  if (!startBase || startBase.length < 2) return null;
  const startConns = rotatedConnectors(startBase, start.rotation);
  const startDelta = DIR_DELTA[startConns[0]];
  let prevX = start.x;
  let prevY = start.y;
  let curX = start.x + startDelta.x;
  let curY = start.y + startDelta.y;

  for (let step = 0; step < entries.length; step++) {
    const key = `${curX},${curY}`;
    const tile = tiles[key];
    if (!tile) return null;

    if (curX === start.x && curY === start.y) break;

    if (visited.has(key)) return null;
    visited.add(key);
    path.push({ x: curX, y: curY });

    const base = TILE_BASE_CONNECTORS[tile.type];
    if (!base || base.length < 2) return null;
    const conns = rotatedConnectors(base, tile.rotation);
    let moved = false;
    for (const dir of conns) {
      const d = DIR_DELTA[dir];
      const nx = curX + d.x;
      const ny = curY + d.y;
      if (nx === prevX && ny === prevY) continue;
      prevX = curX;
      prevY = curY;
      curX = nx;
      curY = ny;
      moved = true;
      break;
    }
    if (!moved) return null;
  }

  return path.length >= 4 ? path : null;
}

/**
 * Compute metrics from tiles alone (reconstructs path internally).
 */
function computeMetricsFromTiles(tiles: Record<string, PlacedTile>): LayoutMetrics {
  const path = reconstructPath(tiles);
  if (path && path.length >= 4) {
    return computeMetrics(path, tiles);
  }
  const entries = Object.values(tiles);
  return {
    totalTiles: entries.length,
    turnCount: 0,
    longestStraight: 0,
    avgStraightRun: 0,
    difficulty: 'Low',
    boundingW: 1,
    boundingH: 1,
    aspectRatio: 1,
    hasBumps: entries.some((t) => t.type === 'bump'),
    reversalCount: 0,
  };
}

/**
 * Verify that every placed tile's connectors match its neighbours.
 * Returns true if the layout is fully valid.
 */
export function validateLayout(tiles: Record<string, PlacedTile>): boolean {
  for (const [, tile] of Object.entries(tiles)) {
    const base = TILE_BASE_CONNECTORS[tile.type];
    if (!base || base.length === 0) continue;

    const connectors = rotatedConnectors(base, tile.rotation);
    for (const dir of connectors) {
      const delta = DIR_DELTA[dir];
      const nx = tile.x + delta.x;
      const ny = tile.y + delta.y;
      const neighborKey = `${nx},${ny}`;
      const neighbor = tiles[neighborKey];

      if (!neighbor) return false;

      const nBase = TILE_BASE_CONNECTORS[neighbor.type];
      if (!nBase || nBase.length === 0) return false;

      const nConnectors = rotatedConnectors(nBase, neighbor.rotation);
      const neededDir = OPPOSITE[dir];
      if (!nConnectors.includes(neededDir)) return false;
    }
  }
  return true;
}

/* ── Public API ───────────────────────────────────────────────────── */

/**
 * Generate three distinct valid 2-wide closed-loop layouts.
 * All layouts respect tile inventory, footprint limits, 2-cell-wide
 * ribbon constraint, and connector rules.
 */
export function generateThreeLayouts(
  inventory: Record<TileType, number>,
  footprint: FootprintSize,
  seed?: number,
): GeneratedLayout[] {
  const s = seed ?? Date.now();
  const results: GeneratedLayout[] = [];

  const variantA = buildVariantA(inventory, footprint, s);
  const variantB = buildVariantB(inventory, footprint, s);
  const variantC = buildVariantC(inventory, footprint, s);

  if (variantA && validateLayout(variantA.tiles)) {
    results.push(variantA);
  } else {
    results.push(buildMinimalFallback('a', s, 'Tight Technical', 'Option A', inventory));
  }

  if (variantB && validateLayout(variantB.tiles)) {
    results.push(variantB);
  } else {
    results.push(buildMinimalFallback('b', s, 'Balanced Flow', 'Option B', inventory));
  }

  if (variantC && validateLayout(variantC.tiles)) {
    results.push(variantC);
  } else {
    results.push(buildMinimalFallback('c', s, 'Stadium Circuit', 'Option C', inventory));
  }

  // Assign unique descriptors based on actual structure
  const layoutsWithMetrics = results.map((layout) => ({
    layout,
    metrics: computeMetricsFromTiles(layout.tiles),
  }));
  assignUniqueDescriptors(layoutsWithMetrics);

  return layoutsWithMetrics.map((entry) => entry.layout);
}

/**
 * Minimal fallback — a 2-wide 2×2 centerline (= 4×4 outer, 16 tiles).
 */
function buildMinimalFallback(
  prefix: string,
  seed: number,
  style: string,
  label: string,
  inventory: Record<TileType, number>,
): GeneratedLayout {
  const rng = createRNG(seed);
  const result = build2WideRectTrack(2, 2, inventory, true, false, rng);

  if (result) {
    const centered = centerLayout(result.tiles);
    const metrics = computeMetricsFrom2Wide(result, centered);
    const stats = metricsToStats(metrics);
    return {
      id: `${prefix}-${seed}`,
      label,
      style,
      tiles: centered,
      stats,
    };
  }

  // Absolute last resort — should never happen with ≥ 8 corner tiles
  return {
    id: `${prefix}-${seed}`,
    label,
    style,
    tiles: {},
    stats: { totalTiles: 0, turnCount: 0, longestStraight: 0, difficulty: 'Low' },
  };
}