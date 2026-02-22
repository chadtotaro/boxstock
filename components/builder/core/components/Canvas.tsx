import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useDrag, useDrop, useDragLayer } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { TileRenderer } from './TileRenderer';
import { FloatingShortcutsPanel } from './Sidebar';

import type { PlacedTile, DragItem, TileType, RoomConstraint } from '@/types/builder';
import { CELL_SIZE, isInBounds } from '@/types/builder';
import { Plus, Minus, Maximize2, Crosshair, Grip } from 'lucide-react';
import { getTileEdgeErrors, type TrackValidation } from '../lib/edge-validator';
import { toast } from 'sonner';

interface CanvasProps {
  tiles: Record<string, PlacedTile>;
  selectedTiles: Set<string>;
  onPlaceTile: (x: number, y: number, tileType: string, rotation: number) => void;
  onSelectTile: (key: string | null, additive?: boolean) => void;
  onMoveTiles: (moves: { fromKey: string; toX: number; toY: number }[]) => void;
  externalPlacedKey?: string | null;
  onExternalPlacedKeyClear?: () => void;
  trackValidation: TrackValidation;
  /** Increment to trigger centering the viewport on the tile centroid */
  centerRequest?: number;
  roomConstraint?: RoomConstraint | null;
}

function getKey(x: number, y: number) {
  return `${x},${y}`;
}

function getVisibleRange(
  containerWidth: number,
  containerHeight: number,
  pan: { x: number; y: number },
  zoom: number,
  padding: number = 2
) {
  const worldLeft = -pan.x / zoom;
  const worldTop = -pan.y / zoom;
  const worldRight = (containerWidth - pan.x) / zoom;
  const worldBottom = (containerHeight - pan.y) / zoom;

  return {
    startCol: Math.floor(worldLeft / CELL_SIZE) - padding,
    endCol: Math.ceil(worldRight / CELL_SIZE) + padding,
    startRow: Math.floor(worldTop / CELL_SIZE) - padding,
    endRow: Math.ceil(worldBottom / CELL_SIZE) + padding,
  };
}

/* ── Custom Drag Layer ───────────────────────────────────────────── */

function CustomDragLayer({ zoom }: { zoom: number }) {
  const { isDragging, item, currentOffset } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    item: monitor.getItem() as DragItem | null,
    currentOffset: monitor.getClientOffset(),
  }));

  if (!isDragging || !item || !currentOffset || !item.fromGrid) return null;

  const size = CELL_SIZE * zoom;

  const content = item.groupTiles && item.groupTiles.length > 0 ? (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10000 }}>
      {item.groupTiles.map((gt, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: currentOffset.x + gt.offsetX * size - size / 2,
            top: currentOffset.y + gt.offsetY * size - size / 2,
            width: size,
            height: size,
            opacity: 0.8,
          }}
        >
          <TileRenderer
            tileType={gt.tile.type}
            rotation={gt.tile.rotation}
            size={size}
          />
        </div>
      ))}
    </div>
  ) : (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10000 }}>
      <div
        style={{
          position: 'absolute',
          left: currentOffset.x - size / 2,
          top: currentOffset.y - size / 2,
          width: size,
          height: size,
          opacity: 0.8,
        }}
      >
        <TileRenderer
          tileType={item.tileType}
          rotation={0}
          size={size}
        />
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

/* ── Draggable Grid Tile ─────────────────────────────────────────── */

interface DraggableGridTileProps {
  tileKey: string;
  tile: PlacedTile;
  tiles: Record<string, PlacedTile>;
  selectedTiles: Set<string>;
  isSelected: boolean;
  isHovered: boolean;
  isJustPlaced: boolean;
  onSelect: (key: string, additive?: boolean) => void;
  onHover: (key: string | null) => void;
  trackValidation: TrackValidation;
}

function DraggableGridTile({
  tileKey, tile, tiles, selectedTiles,
  isSelected, isHovered, isJustPlaced,
  onSelect, onHover, trackValidation,
}: DraggableGridTileProps) {
  const edgeErrors = useMemo(
    () => getTileEdgeErrors(tileKey, trackValidation),
    [tileKey, trackValidation],
  );

  const [{ isDragging }, dragRef, previewRef] = useDrag<DragItem, unknown, { isDragging: boolean }>(() => {
    const isInSelection = selectedTiles.has(tileKey);
    const keysToMove = isInSelection ? Array.from(selectedTiles) : [tileKey];
    const groupTiles = keysToMove
      .map((k) => {
        const t = tiles[k];
        if (!t) return null;
        return { key: k, tile: t, offsetX: t.x - tile.x, offsetY: t.y - tile.y };
      })
      .filter(Boolean) as DragItem['groupTiles'];

    return {
      type: 'TILE',
      item: { type: 'TILE' as const, tileType: tile.type, fromGrid: true, gridX: tile.x, gridY: tile.y, groupTiles },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    };
  }, [tileKey, tile, tiles, selectedTiles]);

  // Hide the native browser drag preview — ghost cells provide the visual feedback
  useEffect(() => {
    previewRef(getEmptyImage(), { captureDraggingState: true });
  }, [previewRef]);

  return (
    <div
      ref={dragRef as unknown as React.Ref<HTMLDivElement>}
      data-tile="true"
      data-tile-type={tile.type}
      data-tile-rotation={tile.rotation}
      className="absolute cursor-grab active:cursor-grabbing"
      style={{
        left: tile.x * CELL_SIZE,
        top: tile.y * CELL_SIZE,
        width: CELL_SIZE,
        height: CELL_SIZE,
        animation: isJustPlaced ? 'tileSnapIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 0 : undefined,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(tileKey, e.shiftKey); }}
      onMouseEnter={() => onHover(tileKey)}
      onMouseLeave={() => onHover(null)}
    >
      <TileRenderer
        tileType={tile.type}
        rotation={tile.rotation}
        size={CELL_SIZE}
        selected={isSelected}
        hovered={isHovered && !isSelected}
        edgeErrors={edgeErrors}
      />
    </div>
  );
}

/* ── Canvas ──────────────────────────────────────────────────────── */

export function Canvas({ tiles, selectedTiles, onPlaceTile, onSelectTile, onMoveTiles, externalPlacedKey, onExternalPlacedKeyClear, trackValidation, centerRequest, roomConstraint }: CanvasProps) {
  const [zoom, setZoom] = useState(0.2);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [ghostCells, setGhostCells] = useState<{ x: number; y: number; tileType: TileType; rotation: number }[]>([]);
  const [dragRotation, setDragRotation] = useState(0);
  const [hoveredTile, setHoveredTile] = useState<string | null>(null);
  const [justPlacedKeys, setJustPlacedKeys] = useState<Set<string>>(new Set());
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isDraggingFromGrid, setIsDraggingFromGrid] = useState(false);
  const [dragSourceKeys, setDragSourceKeys] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const tileCount = Object.keys(tiles).length;

  // ── Center viewport on tile centroid when centerRequest changes ────
  useEffect(() => {
    if (!centerRequest) return;
    const tileArr = Object.values(tiles);
    if (tileArr.length === 0) return;

    // Compute centroid in world-space pixels
    let sumX = 0, sumY = 0;
    for (const t of tileArr) {
      sumX += (t.x + 0.5) * CELL_SIZE;
      sumY += (t.y + 0.5) * CELL_SIZE;
    }
    const cx = sumX / tileArr.length;
    const cy = sumY / tileArr.length;

    // Fit zoom: find bounding box and pick zoom so everything fits
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of tileArr) {
      if (t.x < minX) minX = t.x;
      if (t.y < minY) minY = t.y;
      if (t.x + 1 > maxX) maxX = t.x + 1;
      if (t.y + 1 > maxY) maxY = t.y + 1;
    }
    const worldW = (maxX - minX) * CELL_SIZE;
    const worldH = (maxY - minY) * CELL_SIZE;
    const cw = containerSize.width || 800;
    const ch = containerSize.height || 600;
    const fitZoom = Math.min(cw / (worldW + CELL_SIZE * 2), ch / (worldH + CELL_SIZE * 2), 1);

    setZoom(fitZoom);
    setPan({
      x: cw / 2 - cx * fitZoom,
      y: ch / 2 - cy * fitZoom,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerRequest]);

  // ── Center viewport on room when constraint is enabled ────────────
  const centerOnRoom = () => {
    if (!roomConstraint?.enabled) {
      // Fall back to centering on tiles
      const tileArr = Object.values(tiles);
      if (tileArr.length === 0) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const t of tileArr) {
        if (t.x < minX) minX = t.x;
        if (t.y < minY) minY = t.y;
        if (t.x + 1 > maxX) maxX = t.x + 1;
        if (t.y + 1 > maxY) maxY = t.y + 1;
      }
      const worldW = (maxX - minX) * CELL_SIZE;
      const worldH = (maxY - minY) * CELL_SIZE;
      const cx = ((minX + maxX) / 2) * CELL_SIZE;
      const cy = ((minY + maxY) / 2) * CELL_SIZE;
      const cw = containerSize.width || 800;
      const ch = containerSize.height || 600;
      const fitZoom = Math.min(cw / (worldW + CELL_SIZE * 4), ch / (worldH + CELL_SIZE * 4), 1);
      setZoom(fitZoom);
      setPan({ x: cw / 2 - cx * fitZoom, y: ch / 2 - cy * fitZoom });
      return;
    }
    const rc = roomConstraint;
    const worldW = (rc.maxX - rc.minX + 1) * CELL_SIZE;
    const worldH = (rc.maxY - rc.minY + 1) * CELL_SIZE;
    const cx = ((rc.minX + rc.maxX + 1) / 2) * CELL_SIZE;
    const cy = ((rc.minY + rc.maxY + 1) / 2) * CELL_SIZE;
    const cw = containerSize.width || 800;
    const ch = containerSize.height || 600;
    const fitZoom = Math.min(cw / (worldW + CELL_SIZE * 4), ch / (worldH + CELL_SIZE * 4), 1);
    setZoom(fitZoom);
    setPan({ x: cw / 2 - cx * fitZoom, y: ch / 2 - cy * fitZoom });
  };

  const prevRoomEnabled = useRef(false);
  useEffect(() => {
    const isEnabled = !!(roomConstraint?.enabled);
    if (isEnabled && !prevRoomEnabled.current) {
      // Room just got enabled — center on it
      centerOnRoom();
    }
    prevRoomEnabled.current = isEnabled;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomConstraint?.enabled, roomConstraint?.minX, roomConstraint?.minY, roomConstraint?.maxX, roomConstraint?.maxY]);

  const visRange = useMemo(
    () => getVisibleRange(containerSize.width, containerSize.height, pan, zoom),
    [containerSize.width, containerSize.height, pan, zoom]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (justPlacedKeys.size === 0) return;
    const t = setTimeout(() => setJustPlacedKeys(new Set()), 350);
    return () => clearTimeout(t);
  }, [justPlacedKeys]);

  useEffect(() => {
    if (externalPlacedKey) {
      setJustPlacedKeys(new Set([externalPlacedKey]));
      onExternalPlacedKeyClear?.();
    }
  }, [externalPlacedKey, onExternalPlacedKeyClear]);

  const getCellFromClientCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left - pan.x) / zoom;
      const y = (clientY - rect.top - pan.y) / zoom;
      return { x: Math.floor(x / CELL_SIZE), y: Math.floor(y / CELL_SIZE) };
    },
    [pan, zoom]
  );

  const computeGhostCells = useCallback(
    (item: DragItem, targetCell: { x: number; y: number }) => {
      if (item.fromGrid && item.groupTiles) {
        return item.groupTiles.map((gt) => ({
          x: targetCell.x + gt.offsetX, y: targetCell.y + gt.offsetY,
          tileType: gt.tile.type, rotation: gt.tile.rotation,
        }));
      }
      return [{ x: targetCell.x, y: targetCell.y, tileType: item.tileType, rotation: dragRotation }];
    },
    [dragRotation]
  );

  const [, dropRef] = useDrop<DragItem, void, unknown>(() => ({
    accept: 'TILE',
    hover: (item, monitor) => {
      isDraggingRef.current = true;
      const offset = monitor.getClientOffset();
      if (offset) {
        const cell = getCellFromClientCoords(offset.x, offset.y);
        if (cell) setGhostCells(computeGhostCells(item, cell));
        else setGhostCells([]);
        if (item.fromGrid && item.groupTiles) {
          setIsDraggingFromGrid(true);
          setDragSourceKeys(new Set(item.groupTiles.map((gt) => gt.key)));
        } else {
          setIsDraggingFromGrid(false);
          setDragSourceKeys(new Set());
        }
      }
    },
    drop: (item, monitor) => {
      isDraggingRef.current = false;
      const offset = monitor.getClientOffset();
      if (offset) {
        const cell = getCellFromClientCoords(offset.x, offset.y);
        if (cell) {
          if (item.fromGrid && item.groupTiles) {
            const sourceKeys = new Set(item.groupTiles.map((gt) => gt.key));
            const moves = item.groupTiles.map((gt) => ({
              fromKey: gt.key, toX: cell.x + gt.offsetX, toY: cell.y + gt.offsetY,
            }));
            // Room constraint check for group moves
            if (roomConstraint?.enabled) {
              const anyOutside = moves.some((m) => !isInBounds(m.toX, m.toY, roomConstraint));
              if (anyOutside) {
                toast.error('Outside room bounds.', {
                  style: { backgroundColor: 'var(--c-bg-panel)', border: '1px solid var(--c-error-border-toast)', color: 'var(--c-error)' },
                  duration: 2000,
                });
                setGhostCells([]);
                setDragRotation(0);
                setIsDraggingFromGrid(false);
                setDragSourceKeys(new Set());
                return;
              }
            }
            const allValid = moves.every((m) => {
              const targetKey = getKey(m.toX, m.toY);
              return !tiles[targetKey] || sourceKeys.has(targetKey);
            });
            if (allValid) {
              const isSamePosition = moves.every((m) => m.fromKey === getKey(m.toX, m.toY));
              if (!isSamePosition) {
                onMoveTiles(moves);
              }
            }
          } else {
            const key = getKey(cell.x, cell.y);
            // Room constraint check for single placement
            if (roomConstraint?.enabled && !isInBounds(cell.x, cell.y, roomConstraint)) {
              toast.error('Outside room bounds.', {
                style: { backgroundColor: 'var(--c-bg-panel)', border: '1px solid var(--c-error-border-toast)', color: 'var(--c-error)' },
                duration: 2000,
              });
              setGhostCells([]);
              setDragRotation(0);
              setIsDraggingFromGrid(false);
              setDragSourceKeys(new Set());
              return;
            }
            if (!tiles[key]) {
              onPlaceTile(cell.x, cell.y, item.tileType, dragRotation);
              setJustPlacedKeys(new Set([key]));
            }
          }
        }
      }
      setGhostCells([]);
      setDragRotation(0);
      setIsDraggingFromGrid(false);
      setDragSourceKeys(new Set());
    },
  }), [getCellFromClientCoords, tiles, onPlaceTile, onMoveTiles, dragRotation, computeGhostCells, roomConstraint]);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => { containerRef.current = node; dropRef(node); },
    [dropRef]
  );

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // While dragging a tile from the sidebar, scroll wheel rotates it
      if (isDraggingRef.current && !isDraggingFromGrid) {
        const direction = e.deltaY > 0 ? 90 : -90;
        setDragRotation((prev) => ((prev + direction) % 360 + 360) % 360);
        return;
      }

      // Otherwise: zoom toward the cursor (trackpad pinch or scroll wheel)
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // ctrlKey is set by the browser for trackpad pinch gestures
      const isPinch = e.ctrlKey || e.metaKey;
      // For pinch, deltaY is the zoom amount; for scroll-wheel zoom, use deltaY too
      const delta = isPinch ? -e.deltaY : -e.deltaY * 0.5;
      const sensitivity = isPinch ? 0.01 : 0.002;

      setZoom((prevZoom) => {
        const newZoom = Math.min(Math.max(prevZoom + delta * sensitivity * prevZoom, 0.1), 3);
        const ratio = newZoom / prevZoom;

        // Anchor zoom to cursor position
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        setPan((prevPan) => ({
          x: cursorX - ratio * (cursorX - prevPan.x),
          y: cursorY - ratio * (cursorY - prevPan.y),
        }));

        return newZoom;
      });
    };
    const el = containerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [isDraggingFromGrid]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-tile]')) return;
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      onSelectTile(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.1));
  const handleZoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  useEffect(() => {
    const handleDragEnd = () => {
      isDraggingRef.current = false;
      setGhostCells([]);
      setDragRotation(0);
      setIsDraggingFromGrid(false);
      setDragSourceKeys(new Set());
    };
    window.addEventListener('dragend', handleDragEnd);
    return () => window.removeEventListener('dragend', handleDragEnd);
  }, []);

  const ghostValidity = ghostCells.map((gc) => {
    const key = getKey(gc.x, gc.y);
    if (tiles[key] && !dragSourceKeys.has(key)) return 'occupied';
    if (roomConstraint?.enabled && !isInBounds(gc.x, gc.y, roomConstraint)) return 'out-of-bounds';
    return 'valid';
  });

  const { startCol, endCol, startRow, endRow } = visRange;
  const colCount = endCol - startCol + 1;
  const rowCount = endRow - startRow + 1;
  const svgLeft = startCol * CELL_SIZE;
  const svgTop = startRow * CELL_SIZE;
  const svgWidth = colCount * CELL_SIZE;
  const svgHeight = rowCount * CELL_SIZE;

  return (
    <div
      className="relative flex-1 overflow-hidden"
      style={{ backgroundColor: 'var(--c-canvas-bg)', cursor: isPanning ? 'grabbing' : 'default' }}
    >
      <div
        ref={setRefs}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {/* ── Grid layer (NOT inside TrackVisualLayer) ──────────── */}
          <svg
            className="absolute"
            style={{ left: svgLeft, top: svgTop, width: svgWidth, height: svgHeight, pointerEvents: 'none', overflow: 'visible', zIndex: 18 }}
            viewBox={`${svgLeft} ${svgTop} ${svgWidth} ${svgHeight}`}
          >
            {Array.from({ length: colCount + 1 }).map((_, i) => {
              const x = (startCol + i) * CELL_SIZE;
              return <line key={`v-${startCol + i}`} x1={x} y1={svgTop} x2={x} y2={svgTop + svgHeight} stroke="var(--c-grid-line)" strokeWidth={1.5} />;
            })}
            {Array.from({ length: rowCount + 1 }).map((_, i) => {
              const y = (startRow + i) * CELL_SIZE;
              return <line key={`h-${startRow + i}`} x1={svgLeft} y1={y} x2={svgLeft + svgWidth} y2={y} stroke="var(--c-grid-line)" strokeWidth={1.5} />;
            })}
            {Array.from({ length: colCount + 1 }).map((_, i) => {
              const x = (startCol + i) * CELL_SIZE;
              return <line key={`vd-${startCol + i}`} x1={x} y1={svgTop} x2={x} y2={svgTop + svgHeight} stroke="var(--c-grid-dash)" strokeWidth={1.5} strokeDasharray="2 4" />;
            })}
            {Array.from({ length: rowCount + 1 }).map((_, i) => {
              const y = (startRow + i) * CELL_SIZE;
              return <line key={`hd-${startRow + i}`} x1={svgLeft} y1={y} x2={svgLeft + svgWidth} y2={y} stroke="var(--c-grid-dash)" strokeWidth={1.5} strokeDasharray="2 4" />;
            })}
            <line x1={0} y1={svgTop} x2={0} y2={svgTop + svgHeight} stroke="var(--c-grid-crosshair)" strokeWidth={1} strokeDasharray="4 8" />
            <line x1={svgLeft} y1={0} x2={svgLeft + svgWidth} y2={0} stroke="var(--c-grid-crosshair)" strokeWidth={1} strokeDasharray="4 8" />
            {Array.from({ length: colCount }).map((_, ci) =>
              Array.from({ length: rowCount }).map((_, ri) => (
                <circle
                  key={`dot-${startCol + ci}-${startRow + ri}`}
                  cx={(startCol + ci) * CELL_SIZE + CELL_SIZE / 2}
                  cy={(startRow + ri) * CELL_SIZE + CELL_SIZE / 2}
                  r={1}
                  fill="var(--c-grid-dot)"
                />
              ))
            )}
          </svg>

          {/* ── Room constraint boundary + dark overlay ────────────── */}
          {roomConstraint?.enabled && (() => {
            const rc = roomConstraint;
            const bx = rc.minX * CELL_SIZE;
            const by = rc.minY * CELL_SIZE;
            const bw = (rc.maxX - rc.minX + 1) * CELL_SIZE;
            const bh = (rc.maxY - rc.minY + 1) * CELL_SIZE;
            // Outer overlay: huge rect with a cutout for the boundary
            const PAD = 100000;
            return (
              <>
                {/* Dark overlay outside the boundary */}
                <svg
                  className="absolute pointer-events-none"
                  style={{ left: bx - PAD, top: by - PAD, width: bw + PAD * 2, height: bh + PAD * 2, zIndex: 2, overflow: 'visible', animation: 'roomBoundaryFadeIn 0.3s ease-out' }}
                  viewBox={`${bx - PAD} ${by - PAD} ${bw + PAD * 2} ${bh + PAD * 2}`}
                >
                  <defs>
                    <mask id="room-mask">
                      <rect x={bx - PAD} y={by - PAD} width={bw + PAD * 2} height={bh + PAD * 2} fill="white" />
                      <rect x={bx} y={by} width={bw} height={bh} rx={10} fill="black" />
                    </mask>
                  </defs>
                  <rect
                    x={bx - PAD} y={by - PAD}
                    width={bw + PAD * 2} height={bh + PAD * 2}
                    fill="rgba(0,0,0,0.3)"
                    mask="url(#room-mask)"
                  />
                </svg>
                {/* Boundary rectangle */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: bx,
                    top: by,
                    width: bw,
                    height: bh,
                    border: '2px solid rgba(0,212,255,0.7)',
                    borderRadius: 10,
                    backgroundColor: 'rgba(0,212,255,0.08)',
                    zIndex: 3,
                    animation: 'roomBoundaryFadeIn 0.3s ease-out',
                    boxShadow: '0 0 20px rgba(0,212,255,0.15), inset 0 0 20px rgba(0,212,255,0.05)',
                  }}
                />
                {/* Invalid tile outlines (tiles outside bounds but kept) */}
                {rc.invalidTileKeys.size > 0 && Object.entries(tiles)
                  .filter(([key]) => rc.invalidTileKeys.has(key))
                  .map(([key, tile]) => (
                    <div
                      key={`invalid-${key}`}
                      className="absolute pointer-events-none"
                      style={{
                        left: tile.x * CELL_SIZE,
                        top: tile.y * CELL_SIZE,
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        border: '2px solid rgba(239,68,68,0.7)',
                        borderRadius: 4,
                        zIndex: 4,
                        boxShadow: 'inset 0 0 12px rgba(239,68,68,0.15)',
                      }}
                    />
                  ))
                }
              </>
            );
          })()}

          {/* ── TrackVisualLayer (tiles ONLY — no grid, no ghosts) ── */}
          <div
            id="TrackVisualLayer"
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            {Object.entries(tiles).map(([key, tile]) => (
              <DraggableGridTile
                key={key}
                tileKey={key}
                tile={tile}
                tiles={tiles}
                selectedTiles={selectedTiles}
                isSelected={selectedTiles.has(key)}
                isHovered={hoveredTile === key && !selectedTiles.has(key)}
                isJustPlaced={justPlacedKeys.has(key)}
                onSelect={(k, additive) => onSelectTile(k, additive)}
                onHover={setHoveredTile}
                trackValidation={trackValidation}
              />
            ))}
          </div>

          {/* ── Ghost layer (NOT inside TrackVisualLayer) ─────────── */}
          {ghostCells.length > 0 && ghostCells.map((gc, i) => {
            const validity = ghostValidity[i];
            const isInvalid = validity !== 'valid';
            return (
              <div
                key={`ghost-${i}`}
                className="absolute pointer-events-none"
                style={{
                  left: gc.x * CELL_SIZE,
                  top: gc.y * CELL_SIZE,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  filter: isInvalid ? 'none' : 'drop-shadow(0 4px 8px var(--c-shadow-strong))',
                  transition: 'left 0.08s ease, top 0.08s ease',
                  zIndex: 10,
                }}
              >
                {isInvalid ? (
                  <div className="w-full h-full rounded" style={{
                    backgroundColor: 'var(--c-error-bg)',
                    border: '2px solid var(--c-error-border)',
                  }}>
                    <svg width={CELL_SIZE} height={CELL_SIZE} className="block">
                      <line x1={8} y1={8} x2={CELL_SIZE - 8} y2={CELL_SIZE - 8} stroke="var(--c-error-border)" strokeWidth={1.5} strokeLinecap="round" />
                      <line x1={CELL_SIZE - 8} y1={8} x2={8} y2={CELL_SIZE - 8} stroke="var(--c-error-border)" strokeWidth={1.5} strokeLinecap="round" />
                    </svg>
                  </div>
                ) : (
                  <TileRenderer tileType={gc.tileType} rotation={gc.rotation} size={CELL_SIZE} ghost />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <FloatingShortcutsPanel />
      {/* Empty state */}
      {tileCount === 0 && ghostCells.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex items-center justify-center w-12 h-12 rounded-xl"
              style={{ backgroundColor: 'var(--c-accent-bg-subtle)', border: '1px solid var(--c-accent-border)' }}
            >
              <Grip size={22} style={{ color: 'var(--c-accent)', opacity: 0.4 }} />
            </div>
            <div className="text-center">
              <p style={{ color: 'var(--c-text-muted)', fontSize: '14px' }}>Start building your layout.</p>
              <p style={{ color: 'var(--c-text-dim)', fontSize: '12px', marginTop: '4px' }}>Drag tiles from the left panel.</p>
            </div>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div
        className="absolute bottom-4 right-4 flex flex-col rounded-lg overflow-hidden"
        style={{ backgroundColor: 'var(--c-bg-panel)', border: '1px solid var(--c-border)', boxShadow: '0 4px 12px var(--c-shadow)' }}
      >
        <button
          onClick={handleZoomIn}
          className="flex items-center justify-center w-9 h-9 transition-colors cursor-pointer"
          style={{ color: 'var(--c-text-icon)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)'; e.currentTarget.style.color = 'var(--c-accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--c-text-icon)'; }}
        >
          <Plus size={16} />
        </button>
        <div className="flex items-center justify-center h-7" style={{ color: 'var(--c-text-muted)', fontSize: '10px', borderTop: '1px solid var(--c-border)', borderBottom: '1px solid var(--c-border)' }}>
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={handleZoomOut}
          className="flex items-center justify-center w-9 h-9 transition-colors cursor-pointer"
          style={{ color: 'var(--c-text-icon)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)'; e.currentTarget.style.color = 'var(--c-accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--c-text-icon)'; }}
        >
          <Minus size={16} />
        </button>
        <button
          onClick={handleZoomReset}
          className="flex items-center justify-center w-9 h-9 transition-colors cursor-pointer"
          style={{ color: 'var(--c-text-icon)', borderTop: '1px solid var(--c-border)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)'; e.currentTarget.style.color = 'var(--c-accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--c-text-icon)'; }}
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {!isDraggingFromGrid && dragRotation !== 0 && ghostCells.length > 0 && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full"
          style={{ backgroundColor: 'var(--c-bg-panel)', border: '1px solid var(--c-accent-border)', color: 'var(--c-accent)', fontSize: '11px', zIndex: 10, backdropFilter: 'blur(4px)' }}
        >
          {dragRotation}&deg;
        </div>
      )}

      {selectedTiles.size > 1 && (
        <div
          className="absolute top-4 right-4 px-3 py-1.5 rounded-full"
          style={{ backgroundColor: 'var(--c-bg-panel)', border: '1px solid var(--c-accent-border)', color: 'var(--c-accent)', fontSize: '11px', zIndex: 10, backdropFilter: 'blur(4px)' }}
        >
          {selectedTiles.size} tiles selected
        </div>
      )}

      <CustomDragLayer zoom={zoom} />
    </div>
  );
}