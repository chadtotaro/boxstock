import type { TileDefinition, TileType, Direction } from '@/types/builder';

export const TILE_DEFINITIONS: Record<TileType, TileDefinition> = {
  'straight': {
    type: 'straight',
    label: 'Straight',
    connectors: ['W', 'E'],
  },
  'corner': {
    type: 'corner',
    label: 'Corner',
    connectors: ['N', 'W'],
  },
  'inside-corner': {
    type: 'inside-corner',
    label: 'Inside Corner',
    connectors: ['N', 'W'],
  },
  'inside-corner-45': {
    type: 'inside-corner-45',
    label: 'Inside Corner 45°',
    connectors: [],
  },
  'bump': {
    type: 'bump',
    label: 'Bump',
    connectors: ['W', 'E'],
  },
  'diagonal': {
    type: 'diagonal',
    label: '45°',
    connectors: [],
  },
  'blank': {
    type: 'blank',
    label: 'Blank',
    connectors: [],
  },
};

const ROTATION_MAP: Record<Direction, Direction[]> = {
  'N': ['N', 'E', 'S', 'W'], // at 0°, 90°, 180°, 270°
  'E': ['E', 'S', 'W', 'N'],
  'S': ['S', 'W', 'N', 'E'],
  'W': ['W', 'N', 'E', 'S'],
};

export function getRotatedConnectors(tileType: TileType, rotation: number): Direction[] {
  const def = TILE_DEFINITIONS[tileType];
  const rotationIndex = (rotation / 90) % 4;
  return def.connectors.map((dir) => ROTATION_MAP[dir][rotationIndex]);
}

export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  'N': 'S',
  'S': 'N',
  'E': 'W',
  'W': 'E',
};

export const DIRECTION_OFFSET: Record<Direction, { dx: number; dy: number }> = {
  'N': { dx: 0, dy: -1 },
  'S': { dx: 0, dy: 1 },
  'E': { dx: 1, dy: 0 },
  'W': { dx: -1, dy: 0 },
};

export const TILE_ORDER: TileType[] = [
  'straight',
  'corner',
  'inside-corner',
  'inside-corner-45',
  'bump',
  'diagonal',
  'blank',
];