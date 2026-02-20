import { useState, useMemo } from 'react';
import { useDrag } from 'react-dnd';
import { TileRenderer } from './TileRenderer';
import { TagInput } from './TagInput';
import { TILE_ORDER, TILE_DEFINITIONS } from '@/data/tile-data';
import type { TileType, DragItem, PlacedTile } from '@/types/builder';
import { RotateCw, MousePointer, Redo2, Move, Tag, Trash2, LayoutGrid, Keyboard, X } from 'lucide-react';

interface DraggableTileProps {
  tileType: TileType;
  count: number;
}

function DraggableTile({ tileType, count }: DraggableTileProps) {
  const def = TILE_DEFINITIONS[tileType];

  const [{ isDragging }, dragRef] = useDrag<DragItem, unknown, { isDragging: boolean }>(() => ({
    type: 'TILE',
    item: { type: 'TILE', tileType },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }));

  return (
    <div
      ref={dragRef as unknown as React.Ref<HTMLDivElement>}
      className="flex items-center gap-3 px-3 py-2.5 rounded cursor-grab active:cursor-grabbing transition-all"
      style={{
        backgroundColor: isDragging ? 'var(--c-accent-bg)' : 'var(--c-bg-hover)',
        border: `1px solid ${isDragging ? 'var(--c-accent-border-strong)' : 'var(--c-border-subtle)'}`,
        opacity: isDragging ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)';
          e.currentTarget.style.borderColor = 'var(--c-accent-border)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.backgroundColor = 'var(--c-bg-hover)';
          e.currentTarget.style.borderColor = 'var(--c-border-subtle)';
        }
      }}
    >
      <div className="shrink-0 rounded overflow-hidden" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
        <TileRenderer tileType={tileType} rotation={0} size={40} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p style={{ color: 'var(--c-text-secondary)', fontSize: '13px' }}>{def.label}</p>
          {count > 0 && (
            <span
              className="flex items-center justify-center rounded-full shrink-0"
              style={{
                minWidth: 20, height: 18, padding: '0 5px',
                backgroundColor: 'var(--c-accent-bg)',
                color: 'var(--c-accent)',
                fontSize: '10px',
              }}
            >
              {count}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--c-text-dim)', fontSize: '11px' }}>
          {def.connectors.length > 0 ? def.connectors.join('-') : 'No connectors'}
        </p>
      </div>
    </div>
  );
}

function ShortcutRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {children}
      <span style={{ color: 'var(--c-text-icon)', fontSize: '11px' }}>{label}</span>
    </div>
  );
}

function Kbd({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <kbd
      className="flex items-center justify-center rounded shrink-0"
      style={{
        minWidth: wide ? undefined : 20,
        height: 18,
        padding: wide ? '0 4px' : '0 3px',
        backgroundColor: 'var(--c-kbd-bg)',
        border: '1px solid var(--c-kbd-border)',
        color: 'var(--c-text-icon)',
        fontSize: '9px',
        lineHeight: 1,
      }}
    >
      {children}
    </kbd>
  );
}

interface SidebarProps {
  tiles?: Record<string, PlacedTile>;
  tags?: string[];
  onTagsChange?: (tags: string[]) => void;
  onRemoveDumpedTiles?: () => void;
  hasDumpedTiles?: boolean;
  onOpenLayouts?: () => void;
}


/* ── Floating Shortcuts Panel ── */
export function FloatingShortcutsPanel() {
  const [open, setOpen] = useState(false);
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
  const modKey = isMac ? '⌘' : 'Ctrl';
  return (
    <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 50 }}>
      {open ? (
        <div style={{
          backgroundColor: 'var(--c-bg)',
          border: '1px solid var(--c-border)',
          borderRadius: '10px',
          padding: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          minWidth: '220px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px', letterSpacing: '0.05em', margin: 0 }}>SHORTCUTS</p>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'var(--c-text-muted)' }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <ShortcutRow label="Click tile to select"><div style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MousePointer size={12} style={{ color: 'var(--c-text-muted)' }} /></div></ShortcutRow>
            <ShortcutRow label="Multi-select"><div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Kbd wide>Shift</Kbd><span style={{ color: 'var(--c-text-muted)', fontSize: '9px' }}>+</span><div style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MousePointer size={10} style={{ color: 'var(--c-text-muted)' }} /></div></div></ShortcutRow>
            <ShortcutRow label="Drag to move tile(s)"><div style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Move size={12} style={{ color: 'var(--c-text-muted)' }} /></div></ShortcutRow>
            <ShortcutRow label="Rotate selected"><Kbd>R</Kbd></ShortcutRow>
            <ShortcutRow label="Duplicate selected"><Kbd>D</Kbd></ShortcutRow>
            <ShortcutRow label="Scroll to rotate (drag)"><div style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RotateCw size={11} style={{ color: 'var(--c-text-muted)' }} /></div></ShortcutRow>
            <ShortcutRow label="Remove selected"><Kbd wide>Del</Kbd></ShortcutRow>
            <ShortcutRow label="Undo"><div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Kbd wide>{modKey}</Kbd><Kbd>Z</Kbd></div></ShortcutRow>
            <ShortcutRow label="Redo"><div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Kbd wide>{modKey}</Kbd><Kbd wide>⇧Z</Kbd></div></ShortcutRow>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          title="Keyboard shortcuts"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            border: '1px solid var(--c-border)',
            backgroundColor: 'var(--c-bg)',
            color: 'var(--c-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <Keyboard size={15} />
        </button>
      )}
    </div>
  );
}

export function Sidebar({ tiles = {}, tags = [], onTagsChange, onRemoveDumpedTiles, hasDumpedTiles, onOpenLayouts }: SidebarProps) {
  const tileCounts = useMemo(() => {
    const counts: Record<TileType, number> = {
      'straight': 0, 'corner': 0, 'inside-corner': 0, 'inside-corner-45': 0, 'bump': 0, 'diagonal': 0, 'blank': 0,
    };
    for (const tile of Object.values(tiles)) counts[tile.type]++;
    return counts;
  }, [tiles]);

  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
  const modKey = isMac ? '\u2318' : 'Ctrl';

  return (
    <div
      className="flex flex-col h-full shrink-0 border-r overflow-y-auto"
      style={{ width: '280px', backgroundColor: 'var(--c-bg)', borderColor: 'var(--c-border)' }}
    >
      {/* ── Your Tracks button ── */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <button
          onClick={onOpenLayouts}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg transition-all cursor-pointer"
          style={{
            backgroundColor: 'var(--c-bg-hover)',
            border: '1px solid var(--c-border)',
            color: 'var(--c-text)',
            fontSize: '13px',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)';
            e.currentTarget.style.borderColor = 'var(--c-accent-border)';
            e.currentTarget.style.color = 'var(--c-accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--c-bg-hover)';
            e.currentTarget.style.borderColor = 'var(--c-border)';
            e.currentTarget.style.color = 'var(--c-text)';
          }}
        >
          <LayoutGrid size={16} style={{ flexShrink: 0 }} />
          Your Tracks
        </button>
      </div>

      {/* ── Tags ── */}
      {onTagsChange && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--c-border)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Tag size={11} style={{ color: 'var(--c-text-muted)' }} />
            <span style={{ color: 'var(--c-text-muted)', fontSize: '11px', letterSpacing: '0.03em' }}>TAGS</span>
          </div>
          <TagInput tags={tags} onTagsChange={onTagsChange} />
        </div>
      )}

      {/* ── Tile palette ── */}
      <div className="flex flex-col gap-1.5 p-3">
        {TILE_ORDER.map((tileType) => (
          <DraggableTile key={tileType} tileType={tileType} count={tileCounts[tileType]} />
        ))}
      </div>

      {/* ── Remove dumped tiles ── */}
      {hasDumpedTiles && onRemoveDumpedTiles && (
        <div className="px-3 pb-3">
          <button
            onClick={onRemoveDumpedTiles}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--c-error-bg)',
              border: '1px solid var(--c-error-border)',
              color: 'var(--c-error)',
              fontSize: '12px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--c-error)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--c-error-border)'; }}
          >
            <Trash2 size={13} />
            Remove dumped tiles
          </button>
        </div>
      )}
    </div>
    );
}
