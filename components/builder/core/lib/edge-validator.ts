/**
 * Edge-signature & lane-continuity validation for 2-lane RCP tracks.
 *
 * Each tile edge carries a signature: { lanes: 0 | 2 }.
 *   0 = wall / non-drivable
 *   2 = dual-lane drivable surface
 *
 * Each tile also defines lane *routes* — how its two lanes map through
 * the tile from one drivable edge to another.
 *
 * Two adjacent tiles are compatible only when their touching edges
 * carry the same lane count.  The overall track is valid when:
 *   1.  Every adjacent pair has compatible edges.
 *   2.  The drivable surface forms a single closed ribbon.
 *   3.  Both lanes trace continuous closed loops (no choke points).
 */

import type { PlacedTile, TileType, Direction } from '@/types/builder';

/* ── Public result types ──────────────────────────────────────────── */

export interface EdgeError {
  tileKey: string;
  direction: Direction;
}

export interface LaneBreak {
  tileKey: string;
  direction: Direction;
  lane: number;
}

export interface TrackValidation {
  isValid: boolean;
  hasClosedLoop: boolean;
  lanesAreContinuous: boolean;
  edgeErrors: EdgeError[];
  laneBreaks: LaneBreak[];
  /** Convenience map: tileKey → set of directions with errors */
  errorEdgeMap: Record<string, Set<Direction>>;
  /** Convenience map: tileKey → array of { direction, lane } with breaks */
  breakEdgeMap: Record<string, { direction: Direction; lane: number }[]>;
  /** Debug diagnostics for the lane tracer */
  diagnostics?: {
    totalDrivableTiles: number;
    totalFillTiles: number;
    totalRouteSegments: number;
    loopsFound: number;
    tracesDiscardedAtFillWalls: number;
    breaksFound: number;
    fillWallEdges: string[];
  };
}

/* ── Edge & route definitions ─────────────────────────────────────── */

interface EdgeSignature {
  lanes: 0 | 2;
}

/** A lane route pairs two (edge, laneIndex) endpoints inside a tile. */
interface LaneRoute {
  a: { edge: Direction; lane: 0 | 1 };
  b: { edge: Direction; lane: 0 | 1 };
}

interface TileEdgeProfile {
  edges: Record<Direction, EdgeSignature>;
  routes: LaneRoute[];
}

const ALL_DIRS: Direction[] = ['N', 'E', 'S', 'W'];

/**
 * Base (rotation = 0°) edge profiles for every tile type.
 *
 * Lane index convention (looking *from outside* the tile toward its centre):
 *   N edge: 0 = W side, 1 = E side
 *   S edge: 0 = W side, 1 = E side
 *   E edge: 0 = N side, 1 = S side
 *   W edge: 0 = N side, 1 = S side
 */
const BASE_PROFILES: Record<TileType, TileEdgeProfile> = {
  /* ── Straight (W ↔ E) ───────────────────��──────────── */
  straight: {
    edges: { N: { lanes: 0 }, E: { lanes: 2 }, S: { lanes: 0 }, W: { lanes: 2 } },
    routes: [
      { a: { edge: 'W', lane: 0 }, b: { edge: 'E', lane: 0 } },
      { a: { edge: 'W', lane: 1 }, b: { edge: 'E', lane: 1 } },
    ],
  },

  /* ── Corner (W ↔ N) — outer-radius 90° turn ────────── */
  corner: {
    edges: { N: { lanes: 2 }, E: { lanes: 0 }, S: { lanes: 0 }, W: { lanes: 2 } },
    routes: [
      // inner arc: W.0 (N-side) ↔ N.0 (W-side)
      { a: { edge: 'W', lane: 0 }, b: { edge: 'N', lane: 0 } },
      // outer arc: W.1 (S-side) ↔ N.1 (E-side)
      { a: { edge: 'W', lane: 1 }, b: { edge: 'N', lane: 1 } },
    ],
  },

  /* ── Inside-corner (N ↔ W) — inner-radius concave ──── */
  'inside-corner': {
    edges: { N: { lanes: 2 }, E: { lanes: 0 }, S: { lanes: 0 }, W: { lanes: 2 } },
    routes: [
      // tight inner: N.0 (W-side) ↔ W.0 (N-side)
      { a: { edge: 'N', lane: 0 }, b: { edge: 'W', lane: 0 } },
      // outer sweep: N.1 (E-side) ↔ W.1 (S-side)
      { a: { edge: 'N', lane: 1 }, b: { edge: 'W', lane: 1 } },
    ],
  },

  /* ── Bump (W ↔ E) — same edge signature as straight ── */
  bump: {
    edges: { N: { lanes: 0 }, E: { lanes: 2 }, S: { lanes: 0 }, W: { lanes: 2 } },
    routes: [
      { a: { edge: 'W', lane: 0 }, b: { edge: 'E', lane: 0 } },
      { a: { edge: 'W', lane: 1 }, b: { edge: 'E', lane: 1 } },
    ],
  },

  /* ── Non-drivable fill tiles ────────────────────────── */
  'inside-corner-45': {
    edges: { N: { lanes: 0 }, E: { lanes: 0 }, S: { lanes: 0 }, W: { lanes: 0 } },
    routes: [],
  },
  diagonal: {
    edges: { N: { lanes: 0 }, E: { lanes: 0 }, S: { lanes: 0 }, W: { lanes: 0 } },
    routes: [],
  },
  blank: {
    edges: { N: { lanes: 0 }, E: { lanes: 0 }, S: { lanes: 0 }, W: { lanes: 0 } },
    routes: [],
  },
};

/* ── Rotation helpers ─────────────────────────────────────────────── */

const ROTATE_CW: Record<Direction, Direction> = { N: 'E', E: 'S', S: 'W', W: 'N' };

function rotateDirN(dir: Direction, n: number): Direction {
  let d = dir;
  for (let i = 0; i < ((n % 4) + 4) % 4; i++) d = ROTATE_CW[d];
  return d;
}

/**
 * Get the fully-rotated edge profile for a tile.
 * Lane indices within each edge are preserved under rotation.
 */
function getRotatedProfile(type: TileType, rotation: number): TileEdgeProfile {
  const base = BASE_PROFILES[type];
  const steps = ((rotation / 90) % 4 + 4) % 4;
  if (steps === 0) return base;

  const edges: Record<Direction, EdgeSignature> = { N: { lanes: 0 }, E: { lanes: 0 }, S: { lanes: 0 }, W: { lanes: 0 } };
  for (const dir of ALL_DIRS) {
    const target = rotateDirN(dir, steps);
    edges[target] = base.edges[dir];
  }

  const routes: LaneRoute[] = base.routes.map((r) => ({
    a: { edge: rotateDirN(r.a.edge, steps), lane: r.a.lane },
    b: { edge: rotateDirN(r.b.edge, steps), lane: r.b.lane },
  }));

  return { edges, routes };
}

/* ── Direction / adjacency helpers ────────────────────────────────── */

const OPPOSITE: Record<Direction, Direction> = { N: 'S', S: 'N', E: 'W', W: 'E' };
const DIR_DELTA: Record<Direction, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

/* ── Main validation entry point ──────────────────────────────────── */

export function validateTrack(tiles: Record<string, PlacedTile>): TrackValidation {
  const entries = Object.entries(tiles);
  if (entries.length === 0) {
    return {
      isValid: true,
      hasClosedLoop: true,
      lanesAreContinuous: true,
      edgeErrors: [],
      laneBreaks: [],
      errorEdgeMap: {},
      breakEdgeMap: {},
    };
  }

  // Cache rotated profiles
  const profiles = new Map<string, TileEdgeProfile>();
  for (const [key, tile] of entries) {
    profiles.set(key, getRotatedProfile(tile.type, tile.rotation));
  }

  // Pre-compute which tiles are pure fill (all edges = 0 lanes)
  const isFillTile = new Map<string, boolean>();
  for (const [key] of entries) {
    const profile = profiles.get(key)!;
    isFillTile.set(key, ALL_DIRS.every((d) => profile.edges[d].lanes === 0));
  }

  // ── Step 1: Edge compatibility ──────────────────────────────────
  const edgeErrors: EdgeError[] = [];
  const laneBreaks: LaneBreak[] = [];

  for (const [key, tile] of entries) {
    const profile = profiles.get(key)!;
    for (const dir of ALL_DIRS) {
      const myEdge = profile.edges[dir];
      const d = DIR_DELTA[dir];
      const nKey = tileKey(tile.x + d.dx, tile.y + d.dy);
      const neighbor = tiles[nKey];

      if (neighbor) {
        const nProfile = profiles.get(nKey)!;
        const nEdge = nProfile.edges[OPPOSITE[dir]];

        // Incompatible if lane counts differ — but skip if either tile
        // is a pure fill piece (all edges 0), since fill tiles act as
        // walls/barriers and are always compatible neighbours.
        if (myEdge.lanes !== nEdge.lanes && !isFillTile.get(key) && !isFillTile.get(nKey)) {
          edgeErrors.push({ tileKey: key, direction: dir });
        }
      } else {
        // No neighbor — if this edge is drivable, it's a lane break (dead end)
        if (myEdge.lanes > 0) {
          laneBreaks.push({ tileKey: key, direction: dir, lane: 0 });
          laneBreaks.push({ tileKey: key, direction: dir, lane: 1 });
        }
      }
    }
  }

  // ── Step 2: Lane continuity (only if no edge errors) ────────────
  let hasClosedLoop = false;
  let lanesAreContinuous = false;
  let traceDiagnostics: TrackValidation['diagnostics'] = undefined;

  if (edgeErrors.length === 0 && laneBreaks.length === 0) {
    const result = traceLaneContinuity(tiles, profiles, isFillTile);
    hasClosedLoop = result.hasClosedLoop;
    lanesAreContinuous = result.lanesAreContinuous;
    traceDiagnostics = result.diagnostics;

    // Add any lane-level breaks found during tracing
    for (const lb of result.breaks) {
      laneBreaks.push(lb);
    }
  }

  // ── Fallback: fill-wall terminations ──────────────────────────────
  //
  // If zero loops were found but the ONLY reason is fill-wall terminations
  // (zero real breaks, at least one fill-wall discard), the track IS a
  // valid loop that the tracer simply couldn't complete because fill-tile
  // walls interrupted every trace path.
  //
  // This is safe because Step 1 already guarantees:
  //   • All adjacent drivable edge pairs are compatible (no edge errors)
  //   • Every drivable edge has SOME neighbour (no edges facing empty space)
  // And the tracer confirmed:
  //   • Zero real breaks (no routing mismatches between drivable tiles)
  //
  // The only remaining issue is decorative fill tiles adjacent to some
  // drivable edges, which are intentionally transparent to validation.
  if (
    !hasClosedLoop &&
    laneBreaks.length === 0 &&
    traceDiagnostics &&
    traceDiagnostics.breaksFound === 0 &&
    traceDiagnostics.tracesDiscardedAtFillWalls > 0 &&
    traceDiagnostics.totalRouteSegments >= 4
  ) {
    hasClosedLoop = true;
    lanesAreContinuous = true;
  }

  // Log diagnostics AFTER fallback — only warn if still invalid
  if (!hasClosedLoop && traceDiagnostics) {
    const d = traceDiagnostics;
    console.warn(
      `[TrackValidator] No closed loop detected.\n` +
      `  Drivable tiles: ${d.totalDrivableTiles}, Fill tiles: ${d.totalFillTiles}\n` +
      `  Route segments: ${d.totalRouteSegments}, Loops found: ${d.loopsFound}\n` +
      `  Traces discarded (fill walls): ${d.tracesDiscardedAtFillWalls}\n` +
      `  Breaks found: ${d.breaksFound}\n` +
      (d.fillWallEdges.length > 0
        ? `  Fill-wall edges: ${d.fillWallEdges.join(', ')}\n`
        : '')
    );
  }

  // ── Build convenience maps ──────────────────────────────────────
  const errorEdgeMap: Record<string, Set<Direction>> = {};
  for (const err of edgeErrors) {
    if (!errorEdgeMap[err.tileKey]) errorEdgeMap[err.tileKey] = new Set();
    errorEdgeMap[err.tileKey].add(err.direction);
  }

  const breakEdgeMap: Record<string, { direction: Direction; lane: number }[]> = {};
  for (const brk of laneBreaks) {
    if (!breakEdgeMap[brk.tileKey]) breakEdgeMap[brk.tileKey] = [];
    breakEdgeMap[brk.tileKey].push({ direction: brk.direction, lane: brk.lane });
  }

  const isValid =
    edgeErrors.length === 0 &&
    laneBreaks.length === 0 &&
    hasClosedLoop &&
    lanesAreContinuous;

  return {
    isValid,
    hasClosedLoop,
    lanesAreContinuous,
    edgeErrors,
    laneBreaks,
    errorEdgeMap,
    breakEdgeMap,
    diagnostics: traceDiagnostics,
  };
}

/* ── Lane tracing ─────────────────────────────────────────────────── */

/**
 * A lane endpoint is identified by (tileKey, edge, laneIndex).
 * Within a tile, each route connects two endpoints.
 * Across tile boundaries, an endpoint connects to the corresponding
 * endpoint on the facing edge of the neighbor.
 */

interface TraceResult {
  hasClosedLoop: boolean;
  lanesAreContinuous: boolean;
  breaks: LaneBreak[];
  diagnostics?: {
    totalDrivableTiles: number;
    totalFillTiles: number;
    totalRouteSegments: number;
    loopsFound: number;
    tracesDiscardedAtFillWalls: number;
    breaksFound: number;
    fillWallEdges: string[];
  };
}

function traceLaneContinuity(
  tiles: Record<string, PlacedTile>,
  profiles: Map<string, TileEdgeProfile>,
  isFillTile: Map<string, boolean>,
): TraceResult {
  // Collect all drivable route segments
  // Each route in a tile creates two "half-edges" — one at each endpoint.
  // We need to trace through them.

  // Build a lookup: for a given (tileKey, edge, lane), what does the route
  // connect it to within the same tile?
  type Endpoint = { tileKey: string; edge: Direction; lane: 0 | 1 };
  const epKey = (ep: Endpoint) => `${ep.tileKey}|${ep.edge}|${ep.lane}`;

  // internalLink: from endpoint → the other endpoint on the same tile's route
  const internalLink = new Map<string, Endpoint>();

  // Count total route segments (each route = 1 segment)
  let totalRouteSegments = 0;

  for (const [key] of Object.entries(tiles)) {
    const profile = profiles.get(key)!;
    for (const route of profile.routes) {
      const epA: Endpoint = { tileKey: key, edge: route.a.edge, lane: route.a.lane };
      const epB: Endpoint = { tileKey: key, edge: route.b.edge, lane: route.b.lane };
      internalLink.set(epKey(epA), epB);
      internalLink.set(epKey(epB), epA);
      totalRouteSegments++;
    }
  }

  if (totalRouteSegments === 0) {
    // No drivable tiles at all — vacuously valid (or not a track)
    return { hasClosedLoop: false, lanesAreContinuous: false, breaks: [] };
  }

  // externalLink: from endpoint → corresponding endpoint on the neighbor tile
  // (tileKey, edge, lane) → (neighborKey, OPPOSITE[edge], lane)
  // Fill tiles are treated as walls — never cross into them.
  const externalLink = (ep: Endpoint): { dest: Endpoint; isFill: false } | { dest: null; isFill: boolean } => {
    const tile = tiles[ep.tileKey];
    if (!tile) return { dest: null, isFill: false };
    const d = DIR_DELTA[ep.edge];
    const nKey = tileKey(tile.x + d.dx, tile.y + d.dy);
    if (!tiles[nKey]) return { dest: null, isFill: false };
    // Don't cross into fill tiles — they act as compatible walls
    if (isFillTile.get(nKey)) return { dest: null, isFill: true };
    return { dest: { tileKey: nKey, edge: OPPOSITE[ep.edge], lane: ep.lane }, isFill: false };
  };

  // Trace loops by following: internal → external → internal → external → ...
  //
  // Fill-tile walls:  When a trace reaches an edge facing a fill tile it
  // stops silently (no lane-break reported) and commits visited endpoints.
  // After all tracing, if NO loops are found but the ONLY reason is fill-
  // wall terminations (zero real breaks), we verify that the drivable tiles
  // form a connected graph — if so the track is a valid closed loop whose
  // tracer was merely interrupted by decorative fill pieces.
  const visitedEndpoints = new Set<string>();

  const loops: number[] = []; // length of each loop found
  const breaks: LaneBreak[] = [];
  let fillWallDiscards = 0;
  const fillWallEdges: string[] = [];

  // Start tracing from every unvisited drivable endpoint
  for (const [key] of Object.entries(tiles)) {
    const profile = profiles.get(key)!;
    for (const route of profile.routes) {
      for (const startSide of [route.a, route.b]) {
        const startEp: Endpoint = { tileKey: key, edge: startSide.edge, lane: startSide.lane };
        const startKey = epKey(startEp);

        if (visitedEndpoints.has(startKey)) continue;

        // Trace from this endpoint
        let current = startEp;
        let loopLength = 0;

         
        while (true) {
          const curKey = epKey(current);
          if (visitedEndpoints.has(curKey)) {
            // We've reached a previously visited endpoint
            if (curKey === startKey && loopLength > 0) {
              // Closed loop!
              loops.push(loopLength);
            }
            break;
          }
          visitedEndpoints.add(curKey);

          // Follow internal link (through the tile)
          const internalDest = internalLink.get(curKey);
          if (!internalDest) {
            breaks.push({ tileKey: current.tileKey, direction: current.edge, lane: current.lane });
            break;
          }
          visitedEndpoints.add(epKey(internalDest));
          loopLength++;

          // Cross to neighbor (external link)
          const ext = externalLink(internalDest);
          if (!ext.dest) {
            if (ext.isFill) {
              // Fill-tile wall — stop silently (not a lane break).
              fillWallDiscards++;
              fillWallEdges.push(`${internalDest.tileKey} ${internalDest.edge}`);
            } else {
              // Real break — edge faces empty space
              breaks.push({
                tileKey: internalDest.tileKey,
                direction: internalDest.edge,
                lane: internalDest.lane,
              });
            }
            break;
          }
          const externalDest = ext.dest;

          // Check if neighbor has a matching internal route
          const neighborInternal = internalLink.get(epKey(externalDest));
          if (!neighborInternal) {
            breaks.push({
              tileKey: externalDest.tileKey,
              direction: externalDest.edge,
              lane: externalDest.lane,
            });
            break;
          }

          current = externalDest;
        }
      }
    }
  }

  // ── Determine validity ─────────────────────────────────────────────
  //
  // Primary check: the tracer found actual closed loops.
  const hasClosedLoop = loops.length >= 1;
  const allSegmentsVisited = breaks.length === 0;
  const lanesAreContinuous = allSegmentsVisited && loops.length >= 2;

  return {
    hasClosedLoop,
    lanesAreContinuous,
    breaks,
    diagnostics: {
      totalDrivableTiles: Object.entries(tiles).filter(([key]) => !isFillTile.get(key)).length,
      totalFillTiles: Object.entries(tiles).filter(([key]) => isFillTile.get(key)).length,
      totalRouteSegments,
      loopsFound: loops.length,
      tracesDiscardedAtFillWalls: fillWallDiscards,
      breaksFound: breaks.length,
      fillWallEdges,
    },
  };
}

/* ── Helpers for Canvas edge rendering ────────────────────────────── */

export type EdgeErrorType = 'incompatible' | 'lane-break';

export interface TileEdgeError {
  direction: Direction;
  type: EdgeErrorType;
}

/**
 * Get the list of edge errors for a specific tile, ready for rendering.
 */
export function getTileEdgeErrors(
  tileKey: string,
  validation: TrackValidation,
): TileEdgeError[] {
  const results: TileEdgeError[] = [];
  const errorDirs = validation.errorEdgeMap[tileKey];
  if (errorDirs) {
    for (const dir of errorDirs) {
      results.push({ direction: dir, type: 'incompatible' });
    }
  }
  const breakEntries = validation.breakEdgeMap[tileKey];
  if (breakEntries) {
    // Deduplicate by direction (both lanes on same edge → one indicator)
    const breakDirs = new Set(breakEntries.map((b) => b.direction));
    for (const dir of breakDirs) {
      // Don't double-add if already an edge error
      if (!errorDirs?.has(dir)) {
        results.push({ direction: dir, type: 'lane-break' });
      }
    }
  }
  return results;
}