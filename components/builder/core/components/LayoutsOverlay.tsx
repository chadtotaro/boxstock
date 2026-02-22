import { useState, useMemo, useRef, useEffect } from 'react';
import { X, Search, Grid3X3, List, Plus, MoreHorizontal, Trash2, Copy, Pencil, Clock, Layers } from 'lucide-react';
import { useTheme } from '../hooks/useThemeContext';
import type { Layout, PlacedTile, TileType } from '@/types/builder';

interface LayoutsOverlayProps {
  layouts: Layout[];
  currentLayoutId: string;
  onOpen: (layoutId: string) => void;
  onCreateNew: () => void;
  onDuplicate: (layoutId: string) => void;
  onRename: (layoutId: string, newName: string) => void;
  onDelete: (layoutId: string) => void;
  onClose: () => void;
}

type SortMode = 'recent' | 'name';
type ViewMode = 'grid' | 'list';

const TILE_COLORS: Record<TileType, string> = {
  'straight': '#EBE6E6',
  'corner': '#FE5757',
  'inside-corner': '#FE5757',
  'inside-corner-45': '#FE5757',
  'bump': '#EBE6E6',
  'diagonal': '#555B68',
  'blank': '#2A2E38',
};

/* ── Thumbnail Renderer ──────────────────────────────────────────── */

function LayoutThumbnail({ tiles, width, height }: { tiles: Record<string, PlacedTile>; width: number; height: number }) {
  const tileArr = useMemo(() => Object.values(tiles), [tiles]);

  if (tileArr.length === 0) {
    return (
      <div className="flex items-center justify-center rounded" style={{ width: "100%", height, backgroundColor: "#0A0C10" }}>
        
      </div>
    );
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tileArr) {
    if (t.x < minX) minX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.x > maxX) maxX = t.x;
    if (t.y > maxY) maxY = t.y;
  }

  const rangeX = maxX - minX + 1;
  const rangeY = maxY - minY + 1;
  const padding = 1;
  const totalX = rangeX + padding * 2;
  const totalY = rangeY + padding * 2;
  const cellSize = Math.min(width / totalX, height / totalY);
  const offsetX = (width - totalX * cellSize) / 2;
  const offsetY = (height - totalY * cellSize) / 2;

  return (
    <svg width={width} height={height} className="block rounded" style={{ backgroundColor: '#0A0C10' }}>
      {Array.from({ length: totalX + 1 }).map((_, i) => (
        <line key={`gv-${i}`} x1={offsetX + i * cellSize} y1={offsetY} x2={offsetX + i * cellSize} y2={offsetY + totalY * cellSize} stroke="var(--c-minimap-grid)" strokeWidth={0.5} />
      ))}
      {Array.from({ length: totalY + 1 }).map((_, i) => (
        <line key={`gh-${i}`} x1={offsetX} y1={offsetY + i * cellSize} x2={offsetX + totalX * cellSize} y2={offsetY + i * cellSize} stroke="var(--c-minimap-grid)" strokeWidth={0.5} />
      ))}
      {tileArr.map((tile) => {
        const x = offsetX + (tile.x - minX + padding) * cellSize;
        const y = offsetY + (tile.y - minY + padding) * cellSize;
        return (
          <rect key={`${tile.x},${tile.y}`} x={x + 0.5} y={y + 0.5} width={Math.max(cellSize - 1, 1)} height={Math.max(cellSize - 1, 1)} fill={TILE_COLORS[tile.type]} opacity={0.85} rx={1} />
        );
      })}
    </svg>
  );
}

/* ── Three-dot Menu ──────────────────────────────────────────────── */

function CardMenu({
  layoutId, layoutName, isCurrent, onRename, onDuplicate, onDelete,
}: {
  layoutId: string; layoutName: string; isCurrent: boolean;
  onRename: (id: string, name: string) => void; onDuplicate: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(layoutName);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (renaming) {
    return (
      <input
        autoFocus value={renameValue}
        onChange={(e) => setRenameValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onRename(layoutId, renameValue.trim() || layoutName); setRenaming(false); }
          if (e.key === 'Escape') { setRenameValue(layoutName); setRenaming(false); }
          e.stopPropagation();
        }}
        onBlur={() => { onRename(layoutId, renameValue.trim() || layoutName); setRenaming(false); }}
        onClick={(e) => e.stopPropagation()}
        className="outline-none rounded px-2 py-0.5 w-full"
        style={{ backgroundColor: 'var(--c-bg-elevated)', border: '1px solid var(--c-accent-border-strong)', color: 'var(--c-text)', fontSize: '13px' }}
      />
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center justify-center w-7 h-7 rounded transition-colors cursor-pointer"
        style={{ color: '#FFFFFF' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-bg-input)'; e.currentTarget.style.color = 'var(--c-text)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--c-text-muted)'; }}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 rounded-lg overflow-hidden z-50" style={{ backgroundColor: 'var(--c-menu-bg)', border: '1px solid var(--c-menu-border)', boxShadow: '0 8px 24px var(--c-shadow-strong)', minWidth: 150 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); setRenameValue(layoutName); setRenaming(true); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 transition-colors cursor-pointer"
            style={{ color: 'var(--c-text-secondary)', fontSize: '12px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Pencil size={13} />Rename
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDuplicate(layoutId); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 transition-colors cursor-pointer"
            style={{ color: 'var(--c-text-secondary)', fontSize: '12px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Copy size={13} />Duplicate
          </button>
          <div style={{ height: 1, backgroundColor: 'var(--c-menu-border)' }} />
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(layoutId); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 transition-colors cursor-pointer"
            style={{ color: 'var(--c-error)', fontSize: '12px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-error-bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Trash2 size={13} />Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Layout Card (Grid View) ─────────────────────────────────────── */

function LayoutCard({
  layout, isCurrent, onOpen, onRename, onDuplicate, onDelete,
}: {
  layout: Layout; isCurrent: boolean; onOpen: () => void;
  onRename: (id: string, name: string) => void; onDuplicate: (id: string) => void; onDelete: (id: string) => void;
}) {
  const { isDark } = useTheme();
  const [hovered, setHovered] = useState(false);
  const menuActionRef = useRef(false);
  const tileCount = Object.keys(layout.tiles).length;
  const dateStr = new Date(layout.lastModified).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const thumb = layout.thumbnailDataUrl;
  return (
    <div
      className="rounded-lg transition-all overflow-hidden"
      style={{
        backgroundColor: 'var(--c-bg-panel)',
        border: `1px solid ${isCurrent ? 'var(--c-accent-border-strong)' : hovered ? 'var(--c-card-hover-border)' : 'var(--c-border)'}`,
        boxShadow: hovered ? '0 8px 24px var(--c-shadow)' : '0 2px 8px var(--c-shadow)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (menuActionRef.current) { menuActionRef.current = false; return; } onOpen(); }}
    >
      <div className="relative">
        {thumb ? (
          <img
            src={thumb}
            alt={`${layout.name} thumbnail`}
            className="block w-full"
            style={{ height: 140, objectFit: 'contain', backgroundColor: '#0b0f14' }}
          />
        ) : (
          <LayoutThumbnail tiles={layout.tiles} width={220} height={140} />
        )}

        {isCurrent && (
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: 'var(--c-accent-bg)',
              border: '1px solid var(--c-accent-border-strong)',
              color: 'var(--c-accent)',
              fontSize: '9px',
              letterSpacing: '0.04em',
            }}
          >
            CURRENT
          </div>
        )}

        <div
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { e.stopPropagation(); menuActionRef.current = true; }}
        >
          <CardMenu layoutId={layout.id} layoutName={layout.name} isCurrent={isCurrent} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
        </div>

        {hovered && !isCurrent && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'var(--c-overlay)', backdropFilter: 'blur(2px)' }}>
            <span className="px-4 py-1.5 rounded-full" style={{ backgroundColor: 'var(--c-accent)', color: isDark ? '#0F1115' : '#FFFFFF', fontSize: '12px' }}>
              Open
            </span>
          </div>
        )}
      </div>

      <div className="p-3 pt-2.5">
        <p className="truncate" style={{ color: 'var(--c-text)', fontSize: '13px' }}>{layout.name}</p>
        {(layout.tags ?? []).length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {layout.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full px-2 py-0.5" style={{ backgroundColor: 'var(--c-tag-muted-bg)', color: 'var(--c-tag-muted)', fontSize: '10px' }}>{tag}</span>
            ))}
            {(layout.tags ?? []).length > 3 && <span style={{ color: 'var(--c-text-muted)', fontSize: '10px' }}>+{(layout.tags ?? []).length - 3}</span>}
          </div>
        )}
        <div className="flex items-center gap-3 mt-2" style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>
          <span className="flex items-center gap-1"><Layers size={10} />{tileCount}</span>
          <span className="flex items-center gap-1"><Clock size={10} />{dateStr}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Layout Row (List View) ──────────────────────────────────────── */

function LayoutRow({
  layout, isCurrent, onOpen, onRename, onDuplicate, onDelete,
}: {
  layout: Layout; isCurrent: boolean; onOpen: () => void;
  onRename: (id: string, name: string) => void; onDuplicate: (id: string) => void; onDelete: (id: string) => void;
}) {
  const { isDark } = useTheme();
  const [hovered, setHovered] = useState(false);
  const menuActionRef = useRef(false);
  const tileCount = Object.keys(layout.tiles).length;
  const dateStr = new Date(layout.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-lg transition-all"
      style={{
        backgroundColor: hovered ? 'var(--c-bg-hover)' : 'transparent',
        border: `1px solid ${isCurrent ? 'var(--c-accent-border)' : 'transparent'}`,
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (menuActionRef.current) { menuActionRef.current = false; return; } onOpen(); }}
    >
      <div className="shrink-0"><LayoutThumbnail tiles={layout.tiles} width={64} height={44} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate" style={{ color: 'var(--c-text)', fontSize: '13px' }}>{layout.name}</p>
          {isCurrent && <span className="shrink-0 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--c-accent-bg)', color: 'var(--c-accent)', fontSize: '9px' }}>CURRENT</span>}
        </div>
        {(layout.tags ?? []).length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {layout.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full px-2 py-0.5" style={{ backgroundColor: 'var(--c-tag-muted-bg)', color: 'var(--c-tag-muted)', fontSize: '10px' }}>{tag}</span>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right" style={{ width: 60, color: 'var(--c-text-muted)', fontSize: '12px' }}>
        <span className="flex items-center gap-1 justify-end"><Layers size={11} />{tileCount}</span>
      </div>
      <div className="shrink-0 text-right" style={{ width: 120, color: 'var(--c-text-muted)', fontSize: '12px' }}>{dateStr}</div>
      <div className="shrink-0" style={{ width: 60 }}>
        {hovered && !isCurrent && (
          <span className="px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--c-accent)', color: isDark ? '#0F1115' : '#FFFFFF', fontSize: '11px' }}>Open</span>
        )}
      </div>
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <CardMenu layoutId={layout.id} layoutName={layout.name} isCurrent={isCurrent} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
    </div>
  );
}

/* ── Main Overlay (Modal) ────────────────────────────────────────── */

export function LayoutsOverlay({
  layouts, currentLayoutId, onOpen, onCreateNew, onDuplicate, onRename, onDelete, onClose,
}: LayoutsOverlayProps) {
  const { isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [view, setView] = useState<ViewMode>('grid');
  const [visible, setVisible] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 200); };

  const filtered = useMemo(() => {
    let list = [...layouts];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) => l.name.toLowerCase().includes(q) || l.tags.some((t) => t.includes(q)));
    }
    // Sort without ever pinning current to front — stable ordering
    if (sort === 'recent') list.sort((a, b) => b.lastModified - a.lastModified);
    else list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [layouts, search, sort]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', opacity: visible ? 1 : 0, transitionDuration: '200ms' }}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className="relative flex flex-col w-full transition-all"
        style={{
          maxWidth: 960,
          maxHeight: '85vh',
          backgroundColor: 'var(--c-bg)',
          border: '1px solid var(--c-border)',
          borderRadius: '16px',
          boxShadow: '0 24px 80px var(--c-shadow-strong)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(8px)',
          transitionDuration: '200ms',
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--c-border)' }}>
          <h2 style={{ color: 'var(--c-text)', fontSize: '18px', fontWeight: 600 }}>My Layouts</h2>
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-8 h-8 rounded transition-colors cursor-pointer"
            style={{ color: 'var(--c-text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-bg-hover)'; e.currentTarget.style.color = 'var(--c-text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--c-text-muted)'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b shrink-0 flex-wrap" style={{ borderColor: 'var(--c-border)' }}>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1" style={{ backgroundColor: 'var(--c-bg-elevated)', border: '1px solid var(--c-border)', minWidth: 200, maxWidth: 360 }}>
            <Search size={14} style={{ color: 'var(--c-text-muted)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search layouts..." className="bg-transparent outline-none flex-1" style={{ color: 'var(--c-text)', fontSize: '13px' }} />
          </div>

          <select
            value={sort} onChange={(e) => setSort(e.target.value as SortMode)}
            className="rounded-lg px-3 py-2 outline-none cursor-pointer"
            style={{
              backgroundColor: 'var(--c-bg-elevated)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-text-secondary)',
              fontSize: '12px',
              appearance: 'none',
              paddingRight: 24,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            <option value="recent">Recent</option>
            <option value="name">Name</option>
          </select>

          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
            <button onClick={() => setView('grid')} className="flex items-center justify-center w-8 h-8 transition-colors cursor-pointer" style={{ backgroundColor: view === 'grid' ? 'var(--c-accent-bg)' : 'transparent', color: view === 'grid' ? 'var(--c-accent)' : 'var(--c-text-muted)' }}>
              <Grid3X3 size={14} />
            </button>
            <button onClick={() => setView('list')} className="flex items-center justify-center w-8 h-8 transition-colors cursor-pointer" style={{ backgroundColor: view === 'list' ? 'var(--c-accent-bg)' : 'transparent', color: view === 'list' ? 'var(--c-accent)' : 'var(--c-text-muted)' }}>
              <List size={14} />
            </button>
          </div>

          <div className="flex-1" />

          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors cursor-pointer"
            style={{ backgroundColor: 'var(--c-accent)', color: isDark ? '#0F1115' : '#FFFFFF', fontSize: '13px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-accent-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-accent)'; }}
          >
            <Plus size={14} />New Layout
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl mb-4" style={{ backgroundColor: 'var(--c-bg-hover)', border: '1px solid var(--c-border)' }}>
                <Layers size={24} style={{ color: 'var(--c-text-dim)' }} />
              </div>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '14px' }}>{search.trim() ? 'No layouts match your search' : 'No layouts yet'}</p>
              {!search.trim() && (
                <button onClick={onCreateNew} className="mt-3 px-4 py-2 rounded-lg cursor-pointer transition-colors" style={{ backgroundColor: 'var(--c-accent-bg)', border: '1px solid var(--c-accent-border)', color: 'var(--c-accent)', fontSize: '13px' }}>
                  Create your first layout
                </button>
              )}
            </div>
          ) : view === 'grid' ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {filtered.map((layout) => (
                <LayoutCard key={layout.id} layout={layout} isCurrent={layout.id === currentLayoutId} onOpen={() => { onOpen(layout.id); handleClose(); }} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map((layout) => (
                <LayoutRow key={layout.id} layout={layout} isCurrent={layout.id === currentLayoutId} onOpen={() => { onOpen(layout.id); handleClose(); }} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t shrink-0" style={{ borderColor: 'var(--c-border)' }}>
          <span style={{ color: 'var(--c-text-dim)', fontSize: '11px' }}>{filtered.length} of {layouts.length} layout{layouts.length !== 1 ? 's' : ''}</span>
          <span style={{ color: 'var(--c-text-dim)', fontSize: '11px' }}>Esc to close</span>
        </div>
      </div>
    </div>
  );
}