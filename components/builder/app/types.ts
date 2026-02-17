export type Direction = 'N' | 'E' | 'S' | 'W';

export type TileType = 'straight' | 'corner' | 'inside-corner' | 'inside-corner-45' | 'bump' | 'diagonal' | 'blank';

export interface TileDefinition {
  type: TileType;
  label: string;
  connectors: Direction[];
}

export interface PlacedTile {
  type: TileType;
  x: number;
  y: number;
  rotation: number; // 0, 90, 180, 270
  source?: string;  // e.g. 'inventoryDump' for programmatically placed tiles
}

export interface DragItem {
  type: 'TILE';
  tileType: TileType;
  fromGrid?: boolean;
  gridX?: number;
  gridY?: number;
  /** For group drags: all tiles being moved, with offsets relative to the primary tile */
  groupTiles?: { key: string; tile: PlacedTile; offsetX: number; offsetY: number }[];
}

export interface ConnectionStatus {
  direction: Direction;
  status: 'valid' | 'invalid' | 'open';
}

export interface Layout {
  id: string;
  name: string;
  tags: string[];
  tiles: Record<string, PlacedTile>;
  lastModified: number;
  createdAt: number;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

export const CELL_SIZE = 288;

export type RoomUnit = 'ft' | 'm' | 'cm';

export interface RoomConstraint {
  enabled: boolean;
  cols: number;
  rows: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Original user inputs for display */
  widthValue: number;
  heightValue: number;
  unit: RoomUnit;
  /** Keys of tiles outside bounds that are marked invalid (kept but flagged) */
  invalidTileKeys: Set<string>;
}

export function convertToCm(value: number, unit: RoomUnit): number {
  switch (unit) {
    case 'ft': return value * 30.48;
    case 'm': return value * 100;
    case 'cm': return value;
  }
}

export function computeRoomGrid(widthCm: number, heightCm: number): { cols: number; rows: number } {
  return {
    cols: Math.floor(widthCm / 50),
    rows: Math.floor(heightCm / 50),
  };
}

export function isInBounds(x: number, y: number, constraint: RoomConstraint): boolean {
  return x >= constraint.minX && x <= constraint.maxX && y >= constraint.minY && y <= constraint.maxY;
}