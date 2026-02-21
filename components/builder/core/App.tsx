import { useAuth } from "./hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { TileType, PlacedTile, Layout, SaveStatus, RoomConstraint, RoomUnit } from '@/types/builder';
import { convertToCm, computeRoomGrid } from '@/types/builder';
import { TILE_DEFINITIONS } from '@/data/tile-data';
import { isInBounds } from '@/types/builder';
import { toast, Toaster } from 'sonner';
import { validateTrack, type TrackValidation } from './lib/edge-validator';
import { placeInventoryOnCanvas } from './lib/spiral-placer';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ThemeProvider } from './hooks/useThemeContext';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { LayoutsOverlay } from './components/LayoutsOverlay';
import { GenerateDrawer } from './components/GenerateDrawer';
import { LayoutResultsOverlay, generateThreeLayouts, type GeneratedLayout, type FootprintSize } from './components/LayoutResultsOverlay';
import { useUndoableTiles } from './hooks/useUndoable';
import { RoomSizeModal } from './components/RoomSizeModal';
import { OutsideTilesModal } from './components/OutsideTilesModal';
import { renderThumbnail } from './lib/thumbnail-renderer';
const LAYOUTS_KEY = 'miniz-layouts';
const CURRENT_ID_KEY = 'miniz-current-layout-id';
const USER_KEY = 'miniz-user-id';
const AUTOSAVE_DELAY = 800;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getKey(x: number, y: number) {
  return `${x},${y}`;
}

function createEmptyLayout(name?: string): Layout {
  return {
    id: generateId(),
    name: name || 'Untitled Layout',
    tags: [],
    tiles: {},
    lastModified: Date.now(),
    createdAt: Date.now(),
    tileSize: 50 as const,
  };
}

function loadLayouts(): Layout[] {
  try {
    const data = localStorage.getItem(LAYOUTS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const VALID_TILE_TYPES = new Set(Object.keys(TILE_DEFINITIONS));
        return parsed.map((layout: Layout) => {
          const filteredTiles: Record<string, PlacedTile> = {};
          for (const [key, tile] of Object.entries(layout.tiles || {})) {
            if (tile && VALID_TILE_TYPES.has(tile.type)) {
              filteredTiles[key] = tile;
            }
          }
          return { ...layout, tiles: filteredTiles };
        });
      }
    }
  } catch {}
  return [];
}

function saveLayouts(layouts: Layout[]) {
  try { localStorage.setItem(LAYOUTS_KEY, JSON.stringify(layouts)); } catch {}
}

function loadCurrentId(): string | null {
  try { return localStorage.getItem(CURRENT_ID_KEY); } catch { return null; }
}

function saveCurrentId(id: string) {
  try { localStorage.setItem(CURRENT_ID_KEY, id); } catch {}
}

function migrateOldStorage(): Layout | null {
  try {
    const old = localStorage.getItem('miniz-track-layout');
    if (old) {
      const parsed = JSON.parse(old);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const layout = createEmptyLayout('My First Layout');
        const VALID_TILE_TYPES = new Set(Object.keys(TILE_DEFINITIONS));
        for (const [key, tile] of Object.entries(parsed)) {
          if (tile && typeof tile === 'object' && 'type' in tile && VALID_TILE_TYPES.has((tile as PlacedTile).type)) {
            layout.tiles[key] = tile as PlacedTile;
          }
        }
        localStorage.removeItem('miniz-track-layout');
        return layout;
      }
    }
  } catch {}
  return null;
}


async function saveLayoutToSupabase(layout: Layout, userId: string) {
  await supabase.from('layouts').upsert({
    id: layout.id,
    user_id: userId,
    name: layout.name,
    tiles: layout.tiles,
    tile_size: layout.tileSize,
    tags: layout.tags ?? [],
    room_constraint: layout.roomConstraint ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
}
async function loadLayoutsFromSupabase(userId: string): Promise<Layout[]> {
  const { data, error } = await supabase
    .from('layouts')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  const VALID_TILE_TYPES = new Set(Object.keys(TILE_DEFINITIONS));
  return data.map((row) => {
    const filteredTiles: Record<string, PlacedTile> = {};
    for (const [key, tile] of Object.entries(row.tiles || {})) {
      if (tile && VALID_TILE_TYPES.has((tile as PlacedTile).type)) {
        filteredTiles[key] = tile as PlacedTile;
      }
    }
    return {
      id: row.id,
      name: row.name,
      tags: row.tags ?? [],
      tiles: filteredTiles,
      tileSize: row.tile_size,
      roomConstraint: row.room_constraint ?? null,
      lastModified: new Date(row.updated_at).getTime(),
      createdAt: new Date(row.created_at).getTime(),
    };
  });
}
function AppInner() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [layoutsReady, setLayoutsReady] = useState(false);

  const [currentLayoutId, setCurrentLayoutId] = useState<string>('');

  const currentLayout = layouts.find((l) => l.id === currentLayoutId) || layouts[0];
  const { tiles, setTiles, undo, redo, canUndo, canRedo, resetTo } = useUndoableTiles(currentLayout?.tiles || {});
  const [selectedTiles, setSelectedTiles] = useState<Set<string>>(new Set());
  const [showLayouts, setShowLayouts] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generatedResults, setGeneratedResults] = useState<GeneratedLayout[] | null>(null);
  const [generatedInventory, setGeneratedInventory] = useState<Record<TileType, number> | null>(null);
  const [generatedFootprint, setGeneratedFootprint] = useState<FootprintSize>('medium');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify(currentLayout?.tiles || {}));
  const [lastSavedJson, setLastSavedJson] = useState<string>(
    JSON.stringify(currentLayout?.tiles || {})
  );
  const isDirty = useMemo(() => {
    const current = JSON.stringify(tiles);
    return current !== lastSavedJson;
  }, [tiles, lastSavedJson]);
  const derivedSaveStatus: SaveStatus =
  saveStatus === 'saving'
    ? 'saving'
    : isDirty
      ? 'unsaved'
      : 'saved';
      const performSave = useCallback(async () => {
        setSaveStatus('saving');
      
        const thumb =
        typeof window !== 'undefined'
        ? renderThumbnail({ tiles, width: 260, height: 180 })          : null;
          console.log('Generated thumbnail:', thumb);
        const updated = layouts.map((l) =>
          l.id === currentLayoutId
            ? {
                ...l,
                tiles,
                lastModified: Date.now(),
                thumbnailDataUrl: thumb ?? l.thumbnailDataUrl,
              }
            : l
        );
      
        const current = updated.find((l) => l.id === currentLayoutId);
        const rest = updated.filter((l) => l.id !== currentLayoutId);
        const reordered = current ? [current, ...rest] : updated;
      
        setLayouts(reordered);
        saveLayouts(reordered);

        if (user && current) {
          await saveLayoutToSupabase({ ...current, tiles, lastModified: Date.now() }, user.id);
        }
      
        const saved = JSON.stringify(tiles);
        lastSavedRef.current = saved;
        setLastSavedJson(saved);
      
        setTimeout(() => setSaveStatus('saved'), 300);
      }, [layouts, currentLayoutId, tiles]);
      useEffect(() => {
        if (!authLoading && !user) {
          window.location.href = '/login';
        }
      }, [authLoading, user]);

      useEffect(() => {
        if (!user) return;
        loadLayoutsFromSupabase(user.id).then((remote) => {
          let finalLayouts: Layout[];
          if (remote.length === 0) {
            const fresh = createEmptyLayout('Untitled Layout');
            finalLayouts = [fresh];
            saveLayoutToSupabase({ ...fresh }, user.id);
          } else {
            finalLayouts = remote;
          }
          setLayouts(finalLayouts);
          saveLayouts(finalLayouts);
          setCurrentLayoutId(finalLayouts[0].id);
          saveCurrentId(finalLayouts[0].id);
          setLayoutsReady(true);
        });
      }, [user]);
useEffect(() => {
  const current = JSON.stringify(tiles);
  if (current === lastSavedRef.current) return;

 

  if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

  saveTimerRef.current = setTimeout(() => {
    void performSave();
  }, AUTOSAVE_DELAY);

  return () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  };
}, [tiles, performSave]);

  const updateCurrentLayout = useCallback(
    (updater: (layout: Layout) => Layout) => {
      setLayouts((prev) => {
        const updated = prev.map((l) =>
          l.id === currentLayoutId ? updater({ ...l, lastModified: Date.now() }) : l
        );
        saveLayouts(updated);
        return updated;
      });
    },
    [currentLayoutId]
  );

  const handleShare = useCallback(async (action: 'download' | 'copy') => {
    if (action === 'download') {
      const dataUrl = renderThumbnail({ tiles, width: 2400, height: 1600 });
      if (!dataUrl) return;
      const a = document.createElement('a');
      a.href = dataUrl;
      const layout = layouts.find(l => l.id === currentLayoutId);
      a.download = `${layout?.name ?? 'track'}.png`;
      a.click();
    } else {
      const layout = layouts.find(l => l.id === currentLayoutId);
      const { data, error } = await supabase
        .from('shared_tracks')
        .insert({ layout_name: layout?.name ?? 'Untitled', tiles })
        .select('id')
        .single();
      if (!error && data) {
        const url = `${window.location.origin}/track/${data.id}`;
        await navigator.clipboard.writeText(url);
        toast.success('Link copied!', { description: url });
      }
    }
  }, [tiles, layouts, currentLayoutId]);

  const handleLayoutNameChange = useCallback(
    (name: string) => updateCurrentLayout((l) => ({ ...l, name })),
    [updateCurrentLayout]
  );

  const handleTagsChange = useCallback(
    (tags: string[]) => updateCurrentLayout((l) => ({ ...l, tags })),
    [updateCurrentLayout]
  );

  const toastStyle = useMemo(() => ({
    backgroundColor: 'var(--c-bg-panel)',
    border: '1px solid var(--c-border)',
    color: 'var(--c-text)',
  }), []);

  const handleOpenLayout = useCallback(
    (layoutId: string) => {
      void performSave();
      const target = layouts.find((l) => l.id === layoutId);
      if (target) {
        setCurrentLayoutId(layoutId);
        saveCurrentId(layoutId);
        resetTo(target.tiles);
        setRoomConstraint(target.roomConstraint ?? null);
        const saved = JSON.stringify(target.tiles);
        lastSavedRef.current = saved;
        setLastSavedJson(saved);        setSaveStatus('saved');
        setSelectedTiles(new Set());
        setCenterRequest(r => r + 1);
      }
    },
    [layouts, performSave, resetTo]
  );

  const handleCreateLayout = useCallback(async () => {
    await performSave();
    const newLayout = createEmptyLayout();
    const updated = [newLayout, ...layouts];
    setLayouts(updated);
    saveLayouts(updated);
    setCurrentLayoutId(newLayout.id);
    saveCurrentId(newLayout.id);
    resetTo({});
    setRoomConstraint(null);
    lastSavedRef.current = '{}';
    setLastSavedJson('{}');
    setSaveStatus('saved');
    setSelectedTiles(new Set());
    setCenterRequest(r => r + 1);
    setShowLayouts(false);
    toast.success('New layout created', { style: toastStyle, duration: 1500 });
  }, [layouts, performSave, resetTo, toastStyle]);

  const handleDuplicateLayout = useCallback(
    (layoutId: string) => {
      const source = layouts.find((l) => l.id === layoutId);
      if (!source) return;
      const dup = {
        ...createEmptyLayout(source.name + ' (Copy)'),
        tags: [...source.tags],
        tiles: { ...source.tiles },
      };
      const updated = [dup, ...layouts];
      setLayouts(updated);
      saveLayouts(updated);
      toast.success('Layout duplicated', { style: toastStyle, duration: 1500 });
    },
    [layouts, toastStyle]
  );

  const handleRenameLayout = useCallback(
    (layoutId: string, newName: string) => {
      setLayouts((prev) => {
        const updated = prev.map((l) =>
          l.id === layoutId ? { ...l, name: newName, lastModified: Date.now() } : l
        );
        saveLayouts(updated);
        return updated;
      });
    },
    []
  );

  const handleDeleteLayout = useCallback(
    (layoutId: string) => {
      if (layoutId === currentLayoutId) return;
      setLayouts((prev) => {
        const updated = prev.filter((l) => l.id !== layoutId);
        saveLayouts(updated);
        return updated;
      });
      toast.success('Layout deleted', { style: toastStyle, duration: 1500 });
    },
    [currentLayoutId, toastStyle]
  );

  // ── Tile operations ───────────────────────────────────────────

  const handlePlaceTile = useCallback(
    (x: number, y: number, tileType: string, rotation: number) => {
      const key = getKey(x, y);
      setTiles((prev) => ({ ...prev, [key]: { type: tileType as TileType, x, y, rotation } }));
      setSelectedTiles(new Set([key]));
    },
    [setTiles]
  );

  const handleSelectTile = useCallback((key: string | null, additive?: boolean) => {
    if (key === null) setSelectedTiles(new Set());
    else if (additive) {
      setSelectedTiles((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    } else setSelectedTiles(new Set([key]));
  }, []);

  const handleMoveTiles = useCallback(
    (moves: { fromKey: string; toX: number; toY: number }[]) => {
      setTiles((prev) => {
        const next = { ...prev };
        const movingTiles: { fromKey: string; tile: PlacedTile; toX: number; toY: number }[] = [];
        for (const move of moves) {
          const tile = next[move.fromKey];
          if (tile) movingTiles.push({ fromKey: move.fromKey, tile, toX: move.toX, toY: move.toY });
        }
        for (const mt of movingTiles) delete next[mt.fromKey];
        for (const mt of movingTiles) {
          const newKey = getKey(mt.toX, mt.toY);
          next[newKey] = { ...mt.tile, x: mt.toX, y: mt.toY };
        }
        return next;
      });
      setSelectedTiles(new Set(moves.map((m) => getKey(m.toX, m.toY))));
    },
    [setTiles]
  );

  const rotateTile = useCallback(() => {
    if (selectedTiles.size === 0) return;
    setTiles((prev) => {
      const next = { ...prev };
      for (const key of selectedTiles) {
        const tile = next[key];
        if (tile) next[key] = { ...tile, rotation: (tile.rotation + 90) % 360 };
      }
      return next;
    });
  }, [selectedTiles, setTiles]);

  const deleteTile = useCallback(() => {
    if (selectedTiles.size === 0) return;
    setTiles((prev) => {
      const next = { ...prev };
      for (const key of selectedTiles) delete next[key];
      return next;
    });
    setSelectedTiles(new Set());
  }, [selectedTiles, setTiles]);

  const handleClearAll = useCallback(() => {
    setTiles({});
    setSelectedTiles(new Set());
  }, [setTiles]);

  const [lastDuplicatedKey, setLastDuplicatedKey] = useState<string | null>(null);
  const [centerRequest, setCenterRequest] = useState(1);

  // ── Room Constraint ──────────────────────────────────────────
  const [roomConstraint, setRoomConstraint] = useState<RoomConstraint | null>(null);
  const handleTileSizeChange = useCallback((size: 30 | 50) => {
    setLayouts(prev => prev.map(l =>
      l.id === currentLayoutId ? { ...l, tileSize: size, lastModified: Date.now() } : l
    ));
    // Recalculate room constraint with new tile size
    if (roomConstraint) {
      const wCm = convertToCm(roomConstraint.widthValue, roomConstraint.unit);
      const hCm = convertToCm(roomConstraint.heightValue, roomConstraint.unit);
      const { cols, rows } = computeRoomGrid(wCm, hCm, size);
      const tileArr = Object.values(tiles);
      let centerX = 0, centerY = 0;
      if (tileArr.length > 0) {
        centerX = Math.round(tileArr.reduce((s, t) => s + t.x, 0) / tileArr.length);
        centerY = Math.round(tileArr.reduce((s, t) => s + t.y, 0) / tileArr.length);
      }
      const minX = centerX - Math.floor(cols / 2);
      const minY = centerY - Math.floor(rows / 2);
      setRoomConstraint({ ...roomConstraint, cols, rows, minX, maxX: minX + cols - 1, minY, maxY: minY + rows - 1, invalidTileKeys: new Set() });
    }
  }, [currentLayoutId, setLayouts, roomConstraint, tiles]);

  const [showRoomModal, setShowRoomModal] = useState(false);
  const [outsideTilesInfo, setOutsideTilesInfo] = useState<{
    outsideKeys: string[];
    pendingConstraint: RoomConstraint;
  } | null>(null);

  const handleSetRoomSize = useCallback(
    (width: number, height: number, unit: RoomUnit, cols: number, rows: number) => {
      // Compute viewport center cell
      // We don't have access to pan/zoom directly here, so we compute based on tile centroid or (0,0)
      const tileArr = Object.values(tiles);
      let centerX = 0, centerY = 0;
      if (tileArr.length > 0) {
        let sumX = 0, sumY = 0;
        for (const t of tileArr) { sumX += t.x; sumY += t.y; }
        centerX = Math.round(sumX / tileArr.length);
        centerY = Math.round(sumY / tileArr.length);
      }

      const minX = centerX - Math.floor(cols / 2);
      const maxX = minX + cols - 1;
      const minY = centerY - Math.floor(rows / 2);
      const maxY = minY + rows - 1;

      const newConstraint: RoomConstraint = {
        enabled: true,
        cols, rows,
        minX, maxX, minY, maxY,
        widthValue: width, heightValue: height, unit,
        invalidTileKeys: new Set(),
      };

      // Check if any tiles exist outside bounds
      const outsideKeys: string[] = [];
      for (const [key, tile] of Object.entries(tiles)) {
        if (!isInBounds(tile.x, tile.y, newConstraint)) {
          outsideKeys.push(key);
        }
      }

      if (outsideKeys.length > 0) {
        setOutsideTilesInfo({ outsideKeys, pendingConstraint: newConstraint });
      } else {
        setRoomConstraint(newConstraint);
        setLayouts(prev => prev.map(l => l.id === currentLayoutId ? { ...l, roomConstraint: newConstraint } : l));
        toast.success(`Room constraint set: ${cols} x ${rows} tiles`, { style: toastStyle, duration: 2000 });
      }

      setShowRoomModal(false);
    },
    [tiles, toastStyle]
  );

  const handleOutsideTilesCancel = useCallback(() => {
    setOutsideTilesInfo(null);
  }, []);

  const handleOutsideTilesRemove = useCallback(() => {
    if (!outsideTilesInfo) return;
    const keysToRemove = new Set(outsideTilesInfo.outsideKeys);
    setTiles((prev) => {
      const next: Record<string, PlacedTile> = {};
      for (const [key, tile] of Object.entries(prev)) {
        if (!keysToRemove.has(key)) next[key] = tile;
      }
      return next;
    });
    setSelectedTiles(new Set());
    setRoomConstraint(outsideTilesInfo.pendingConstraint);
    setOutsideTilesInfo(null);
    toast.success(`Room constraint set, ${keysToRemove.size} tile${keysToRemove.size !== 1 ? 's' : ''} removed`, { style: toastStyle, duration: 2000 });
  }, [outsideTilesInfo, setTiles, toastStyle]);

  const handleOutsideTilesKeepInvalid = useCallback(() => {
    if (!outsideTilesInfo) return;
    const constraint = { ...outsideTilesInfo.pendingConstraint, invalidTileKeys: new Set(outsideTilesInfo.outsideKeys) };
    setRoomConstraint(constraint);
    setOutsideTilesInfo(null);
    toast.success('Room constraint set, outside tiles marked invalid', { style: toastStyle, duration: 2000 });
  }, [outsideTilesInfo, toastStyle]);

  const handleDisableRoomConstraint = useCallback(() => {
    setRoomConstraint(null);
    setLayouts(prev => prev.map(l => l.id === currentLayoutId ? { ...l, roomConstraint: null } : l));
    toast.success('Room constraint disabled', { style: toastStyle, duration: 1500 });
  }, [toastStyle]);

  // ── Inventory placement ───────────────────────────────────────

  const hasDumpedTiles = useMemo(
    () => Object.values(tiles).some((t) => t.source === 'inventoryDump'),
    [tiles],
  );

  const handlePlaceInventory = useCallback(
    (inventory: Record<TileType, number>) => {
      const result = placeInventoryOnCanvas(inventory, tiles);
      if (result.count === 0) return;
      setTiles((prev) => ({ ...prev, ...result.newTiles }));
      setSelectedTiles(new Set());
      setCenterRequest((c) => c + 1);
      toast.success(`Placed ${result.count} tiles`, { style: toastStyle, duration: 2000 });
    },
    [tiles, setTiles, toastStyle],
  );

  const handleRemoveDumpedTiles = useCallback(() => {
    setTiles((prev) => {
      const next: Record<string, PlacedTile> = {};
      for (const [key, tile] of Object.entries(prev)) {
        if (tile.source !== 'inventoryDump') next[key] = tile;
      }
      return next;
    });
    setSelectedTiles(new Set());
    toast.success('Removed dumped inventory tiles', { style: toastStyle, duration: 2000 });
  }, [setTiles, toastStyle]);

  const duplicateTile = useCallback(() => {
    if (selectedTiles.size === 0) return;
    const firstKey = Array.from(selectedTiles)[0];
    const source = tiles[firstKey];
    if (!source) return;

    const visited = new Set<string>();
    const queue: { x: number; y: number }[] = [];
    const BFS_RADIUS = 50;
    const directions = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];

    for (const d of directions) {
      const nx = source.x + d.dx, ny = source.y + d.dy;
      const k = getKey(nx, ny);
      if (!visited.has(k)) { visited.add(k); queue.push({ x: nx, y: ny }); }
    }

    let targetCell: { x: number; y: number } | null = null;
    while (queue.length > 0) {
      const cell = queue.shift()!;
      const key = getKey(cell.x, cell.y);
      if (!tiles[key]) { targetCell = cell; break; }
      for (const d of directions) {
        const nx = cell.x + d.dx, ny = cell.y + d.dy;
        if (Math.abs(nx - source.x) <= BFS_RADIUS && Math.abs(ny - source.y) <= BFS_RADIUS) {
          const nk = getKey(nx, ny);
          if (!visited.has(nk)) { visited.add(nk); queue.push({ x: nx, y: ny }); }
        }
      }
    }

    if (targetCell) {
      const newKey = getKey(targetCell.x, targetCell.y);
      setTiles((prev) => ({
        ...prev,
        [newKey]: { type: source.type, x: targetCell.x, y: targetCell.y, rotation: source.rotation },
      }));
      setSelectedTiles(new Set([newKey]));
      setLastDuplicatedKey(newKey);
      toast.success('Tile duplicated', { style: toastStyle, duration: 1500 });
    } else {
      toast.error('No empty space available', {
        style: { backgroundColor: 'var(--c-bg-panel)', border: '1px solid var(--c-error-border-toast)', color: 'var(--c-error)' },
        duration: 1500,
      });
    }
  }, [selectedTiles, tiles, setTiles, toastStyle]);

  // ── Keyboard shortcuts ────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const isCmd = e.metaKey || e.ctrlKey;
      if (isCmd && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); return; }
      if (isCmd && e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); redo(); return; }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); rotateTile(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteTile(); }
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); duplicateTile(); }
      if (e.key === 'Escape') {
        if (generatedResults) { setGeneratedResults(null); setGeneratedInventory(null); }
        else if (showGenerate) setShowGenerate(false);
        else if (showLayouts) setShowLayouts(false);
        else setSelectedTiles(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rotateTile, deleteTile, duplicateTile, undo, redo, showLayouts, showGenerate, generatedResults]);

  const trackValidation = useMemo<TrackValidation>(() => {
    return validateTrack(tiles);
  }, [tiles]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ backgroundColor: 'var(--c-bg)' }}>
        <style>{`
          @keyframes tileSnapIn {
            0% { transform: scale(0.6); opacity: 0.3; }
            60% { transform: scale(1.08); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes roomBoundaryFadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>

        <div className="flex flex-1 overflow-hidden">
          <Sidebar tiles={tiles} tags={currentLayout?.tags || []} onTagsChange={handleTagsChange} onRemoveDumpedTiles={handleRemoveDumpedTiles} hasDumpedTiles={hasDumpedTiles} onOpenLayouts={() => setShowLayouts(true)} tileSize={currentLayout?.tileSize ?? 50} onTileSizeChange={handleTileSizeChange} />
          <div className="flex flex-col flex-1 overflow-hidden" style={{
            opacity: generatedResults ? 0.4 : 1,
            transition: "opacity 320ms ease",
            pointerEvents: generatedResults ? "none" : "auto",
          }}>
            <TopBar
              layoutName={currentLayout?.name || "Untitled"}
              onLayoutNameChange={handleLayoutNameChange}
              saveStatus={derivedSaveStatus}
              onOpenGenerate={() => setShowGenerate(true)}
              onShare={handleShare}
              onSignOut={signOut}
              userEmail={user?.email ?? ""}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              tileCount={Object.keys(tiles).length}
              trackValidation={trackValidation}
              onClearAll={handleClearAll}
              roomConstraint={roomConstraint}
              onOpenRoomSize={() => setShowRoomModal(true)}
              onDisableRoomConstraint={handleDisableRoomConstraint}
            />
            <Canvas
            tiles={tiles}
            selectedTiles={selectedTiles}
            onPlaceTile={handlePlaceTile}
            onSelectTile={handleSelectTile}
            onMoveTiles={handleMoveTiles}
            externalPlacedKey={lastDuplicatedKey}
            onExternalPlacedKeyClear={() => setLastDuplicatedKey(null)}
            trackValidation={trackValidation}
            centerRequest={centerRequest}
            roomConstraint={roomConstraint}
          />
          </div>
        </div>

        {showLayouts && (
          <LayoutsOverlay
            layouts={layouts}
            currentLayoutId={currentLayoutId}
            onOpen={handleOpenLayout}
            onCreateNew={handleCreateLayout}
            onDuplicate={handleDuplicateLayout}
            onRename={handleRenameLayout}
            onDelete={handleDeleteLayout}
            onClose={() => setShowLayouts(false)}
          />
        )}

        <GenerateDrawer
          open={showGenerate}
          onClose={() => setShowGenerate(false)}
          onShowResults={(results, inventory, footprint) => {
            setGeneratedResults(results);
            setGeneratedInventory(inventory);
            setGeneratedFootprint(footprint);
          }}
          onPlaceInventory={handlePlaceInventory}
          onRemoveDumpedTiles={handleRemoveDumpedTiles}
          hasDumpedTiles={hasDumpedTiles}
          
        />

        {generatedResults && (
          <LayoutResultsOverlay
            layouts={generatedResults}
            hasExistingTiles={Object.keys(tiles).length > 0}
            onSelect={(newTiles, style) => {
              setGeneratedResults(null);
              setSelectedTiles(new Set());

              // Update layout name
              const newName = `Generated Layout \u2013 ${style}`;
              handleLayoutNameChange(newName);

              // Stagger tile placement for animation
              const entries = Object.entries(newTiles);
              if (entries.length === 0) {
                setTiles({});
                return;
              }

              // Clear canvas first, then animate tiles in batches
              setTiles({});
              const BATCH_SIZE = 4;
              const BATCH_DELAY = 60;
              for (let i = 0; i < entries.length; i += BATCH_SIZE) {
                const batch = entries.slice(i, i + BATCH_SIZE);
                setTimeout(() => {
                  setTiles((prev) => {
                    const next = { ...prev };
                    for (const [key, tile] of batch) {
                      next[key] = tile;
                    }
                    return next;
                  });
                  // Trigger snap animation for last tile in batch
                  const lastKey = batch[batch.length - 1][0];
                  setLastDuplicatedKey(lastKey);
                }, (i / BATCH_SIZE) * BATCH_DELAY);
              }

              const totalTime = Math.ceil(entries.length / BATCH_SIZE) * BATCH_DELAY + 200;
              setTimeout(() => {
                setLastDuplicatedKey(null);
                toast.success(`Layout applied \u2013 ${style}`, { style: toastStyle, duration: 2000 });
              }, totalTime);
            }}
            onRegenerate={() => {
              if (generatedInventory) {
                const seed = Date.now();
                const newResults = generateThreeLayouts(generatedInventory, generatedFootprint, seed);
                setGeneratedResults(newResults);
              }
            }}
            onClose={() => {
              setGeneratedResults(null);
              setGeneratedInventory(null);
            }}
          />
        )}

        <Toaster position="bottom-center" />

        <RoomSizeModal
          open={showRoomModal}
          onClose={() => setShowRoomModal(false)}
          onApply={handleSetRoomSize}
          initialWidth={roomConstraint?.widthValue}
          initialHeight={roomConstraint?.heightValue}
          initialUnit={roomConstraint?.unit}
          tileSize={currentLayout?.tileSize ?? 50}
          onClear={handleDisableRoomConstraint}
          hasConstraint={!!roomConstraint?.enabled}
        />

        <OutsideTilesModal
          open={outsideTilesInfo !== null}
          outsideCount={outsideTilesInfo?.outsideKeys.length ?? 0}
          onCancel={handleOutsideTilesCancel}
          onRemove={handleOutsideTilesRemove}
          onKeepInvalid={handleOutsideTilesKeepInvalid}
        />
      </div>
    </DndProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}