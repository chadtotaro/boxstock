import { useState, useRef, useEffect } from 'react';
import { Zap, Undo2, Redo2, Layers, Check, Loader2, Moon, Sun, CircleCheck, CircleAlert, AlertTriangle, Trash2, Ruler, X } from 'lucide-react';
import { useTheme } from '../hooks/useThemeContext';
import type { SaveStatus } from '../types';
import type { TrackValidation } from '../lib/edge-validator';
import type { RoomConstraint } from '../types';

interface TopBarProps {
  layoutName: string;
  onLayoutNameChange: (name: string) => void;
  saveStatus: SaveStatus;
  onOpenLayouts: () => void;
  onOpenGenerate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  tileCount: number;
  trackValidation: TrackValidation;
  onClearAll: () => void;
  roomConstraint?: RoomConstraint | null;
  onOpenRoomSize?: () => void;
  onDisableRoomConstraint?: () => void;
}

function IconButton({
  onClick,
  disabled,
  children,
  tooltip,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  tooltip: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className="flex items-center justify-center w-8 h-8 rounded transition-all cursor-pointer disabled:cursor-default"
      style={{
        backgroundColor: 'transparent',
        color: disabled ? 'var(--c-text-icon-disabled)' : 'var(--c-text-icon)',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)';
          e.currentTarget.style.color = 'var(--c-accent)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = disabled ? 'var(--c-text-icon-disabled)' : 'var(--c-text-icon)';
      }}
    >
      {children}
    </button>
  );
}

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5" style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>
        <Loader2 size={11} className="animate-spin" />
        Saving...
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1" style={{ color: 'var(--c-success)', fontSize: '11px' }}>
        <Check size={11} />
        Saved
      </span>
    );
  }
  return (
    <span style={{ color: 'var(--c-warning)', fontSize: '11px' }}>
      Unsaved changes
    </span>
  );
}

function TrackStatusBadge({ validation }: { validation: TrackValidation }) {
  const errorCount = validation.edgeErrors.length + validation.laneBreaks.length;

  if (validation.isValid) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{
          backgroundColor: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.2)',
        }}
        title="Track forms a valid 2-lane closed loop"
      >
        <CircleCheck size={12} style={{ color: '#22C55E' }} />
        <span style={{ color: '#22C55E', fontSize: '11px' }}>Valid Track</span>
      </div>
    );
  }

  if (errorCount > 0) {
    const hasEdge = validation.edgeErrors.length > 0;
    const hasLane = validation.laneBreaks.length > 0;
    const label = hasEdge && hasLane
      ? 'Edge + Lane Errors'
      : hasEdge
        ? `${validation.edgeErrors.length} Edge Error${validation.edgeErrors.length > 1 ? 's' : ''}`
        : `Lane Break${validation.laneBreaks.length > 1 ? 's' : ''}`;

    const dirLabel: Record<string, string> = { N: 'North', E: 'East', S: 'South', W: 'West' };
    const tooltipLines: string[] = [];
    if (hasEdge) {
      tooltipLines.push(`${validation.edgeErrors.length} incompatible edge${validation.edgeErrors.length > 1 ? 's' : ''}:`);
      // Group edge errors by tile
      const byTile: Record<string, string[]> = {};
      for (const err of validation.edgeErrors) {
        (byTile[err.tileKey] ??= []).push(dirLabel[err.direction]);
      }
      for (const [key, dirs] of Object.entries(byTile)) {
        tooltipLines.push(`  Tile ${key}: ${dirs.join(', ')}`);
      }
    }
    if (hasLane) {
      tooltipLines.push(`${validation.laneBreaks.length} lane break${validation.laneBreaks.length > 1 ? 's' : ''}:`);
      const byTile: Record<string, string[]> = {};
      for (const brk of validation.laneBreaks) {
        (byTile[brk.tileKey] ??= []).push(`${dirLabel[brk.direction]} (lane ${brk.lane})`);
      }
      for (const [key, dirs] of Object.entries(byTile)) {
        tooltipLines.push(`  Tile ${key}: ${dirs.join(', ')}`);
      }
    }
    tooltipLines.push('', 'Hover over highlighted edges on tiles for details.');

    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-help"
        style={{
          backgroundColor: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
        }}
        title={tooltipLines.join('\n')}
      >
        <CircleAlert size={12} style={{ color: '#EF4444' }} />
        <span style={{ color: '#EF4444', fontSize: '11px' }}>{label}</span>
      </div>
    );
  }

  // No edge errors or lane breaks, but not a valid closed loop
  const reason = !validation.hasClosedLoop
    ? 'No closed loop'
    : !validation.lanesAreContinuous
      ? 'Lane discontinuity'
      : 'Invalid';

  const d = validation.diagnostics;
  let tooltipDetail: string;

  if (!validation.hasClosedLoop && d) {
    const lines: string[] = [
      'The lane tracer could not find a closed loop.',
      '',
      `Drivable tiles: ${d.totalDrivableTiles}`,
      `Fill tiles: ${d.totalFillTiles}`,
      `Route segments: ${d.totalRouteSegments}`,
      `Loops found: ${d.loopsFound}`,
      `Breaks: ${d.breaksFound}`,
    ];
    if (d.tracesDiscardedAtFillWalls > 0) {
      lines.push(`Traces blocked by fill tiles: ${d.tracesDiscardedAtFillWalls}`);
      const uniqueEdges = [...new Set(d.fillWallEdges)];
      if (uniqueEdges.length > 0) {
        lines.push(`Fill-wall edges: ${uniqueEdges.slice(0, 8).join(', ')}${uniqueEdges.length > 8 ? '...' : ''}`);
      }
    }
    lines.push('', 'Check browser console for full diagnostics.');
    tooltipDetail = lines.join('\n');
  } else if (!validation.hasClosedLoop) {
    tooltipDetail = 'The track does not form a closed loop — connect all drivable edges into a continuous circuit.';
  } else if (!validation.lanesAreContinuous) {
    tooltipDetail = 'Both lanes must trace continuous closed loops through the track without dead ends.';
  } else {
    tooltipDetail = 'The track has an unknown validation issue.';
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-help"
      style={{
        backgroundColor: 'rgba(245,158,11,0.1)',
        border: '1px solid rgba(245,158,11,0.2)',
      }}
      title={tooltipDetail}
    >
      <AlertTriangle size={12} style={{ color: '#F59E0B' }} />
      <span style={{ color: '#F59E0B', fontSize: '11px' }}>{reason}</span>
    </div>
  );
}

export function TopBar({
  layoutName,
  onLayoutNameChange,
  saveStatus,
  onOpenLayouts,
  onOpenGenerate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  tileCount,
  trackValidation,
  onClearAll,
  roomConstraint,
  onOpenRoomSize,
  onDisableRoomConstraint,
}: TopBarProps) {
  const { isDark, toggle } = useTheme();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(layoutName);
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => { setEditValue(layoutName); }, [layoutName]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.select(); }, [editing]);

  // Auto-dismiss the confirm prompt after 3 seconds
  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const commitName = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== layoutName) onLayoutNameChange(trimmed);
    else setEditValue(layoutName);
    setEditing(false);
  };

  return (
    <div
      className="flex items-center justify-between px-5 h-14 border-b shrink-0"
      style={{ backgroundColor: 'var(--c-bg)', borderColor: 'var(--c-border)' }}
    >
      {/* Left: Logo + editable name */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex items-center justify-center w-8 h-8 rounded shrink-0"
          style={{ backgroundColor: 'var(--c-accent-bg)' }}
        >
          <Zap size={18} style={{ color: 'var(--c-accent)' }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {editing ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitName();
                  if (e.key === 'Escape') { setEditValue(layoutName); setEditing(false); }
                }}
                className="outline-none rounded px-1.5 py-0.5 min-w-0"
                style={{
                  backgroundColor: 'var(--c-bg-input)',
                  border: '1px solid var(--c-accent-border)',
                  color: 'var(--c-text)',
                  fontSize: '15px',
                  width: Math.max(120, editValue.length * 9 + 20),
                  maxWidth: 300,
                }}
              />
            ) : (
              <h1
                className="tracking-wide truncate cursor-pointer transition-colors"
                style={{ color: 'var(--c-text)', fontSize: '15px', lineHeight: '1.2', maxWidth: 300 }}
                onClick={() => setEditing(true)}
                title="Click to rename"
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--c-accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--c-text)'; }}
              >
                {layoutName}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <p style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>
              {tileCount} tile{tileCount !== 1 ? 's' : ''} placed
            </p>
            <SaveStatusIndicator status={saveStatus} />
          </div>
        </div>
      </div>

      {/* Center: Undo/Redo + Clear All + Track Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5">
          <IconButton onClick={onUndo} disabled={!canUndo} tooltip="Undo (Ctrl+Z)">
            <Undo2 size={16} />
          </IconButton>
          <IconButton onClick={onRedo} disabled={!canRedo} tooltip="Redo (Ctrl+Shift+Z)">
            <Redo2 size={16} />
          </IconButton>
        </div>

        {tileCount > 0 && (
          <>
            <div style={{ width: 1, height: 20, backgroundColor: 'var(--c-border)' }} />
            {confirmClear ? (
              <div className="flex items-center gap-1.5">
                <span style={{ color: 'var(--c-text-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                  Clear {tileCount} tile{tileCount !== 1 ? 's' : ''}?
                </span>
                <button
                  onClick={() => { onClearAll(); setConfirmClear(false); }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded transition-all cursor-pointer"
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#EF4444',
                    fontSize: '11px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)';
                  }}
                >
                  Yes, clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-0.5 rounded transition-all cursor-pointer"
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-text-muted)',
                    fontSize: '11px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                title="Clear all tiles"
                className="flex items-center gap-1.5 px-2 py-1 rounded transition-all cursor-pointer"
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid transparent',
                  color: 'var(--c-text-muted)',
                  fontSize: '12px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
                  e.currentTarget.style.color = '#EF4444';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.color = 'var(--c-text-muted)';
                }}
              >
                <Trash2 size={13} />
                Clear All
              </button>
            )}
          </>
        )}

        {tileCount > 0 && <TrackStatusBadge validation={trackValidation} />}

        {/* Room constraint pill / invalid tiles warning */}
        {roomConstraint?.enabled && (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: 'rgba(0,212,255,0.1)',
                border: '1px solid rgba(0,212,255,0.2)',
              }}
            >
              <Ruler size={12} style={{ color: '#00D4FF' }} />
              <span style={{ color: '#00D4FF', fontSize: '11px', whiteSpace: 'nowrap' }}>
                Room {roomConstraint.cols}x{roomConstraint.rows}
              </span>
              <button
                onClick={onDisableRoomConstraint}
                className="flex items-center justify-center w-4 h-4 rounded-full transition-all cursor-pointer ml-0.5"
                style={{ backgroundColor: 'rgba(0,212,255,0.15)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,212,255,0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,212,255,0.15)'; }}
                title="Disable room constraint"
              >
                <X size={10} style={{ color: '#00D4FF' }} />
              </button>
            </div>
            {roomConstraint.invalidTileKeys.size > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.2)',
                }}
                title={`${roomConstraint.invalidTileKeys.size} tile${roomConstraint.invalidTileKeys.size !== 1 ? 's' : ''} outside room bounds`}
              >
                <AlertTriangle size={12} style={{ color: '#F59E0B' }} />
                <span style={{ color: '#F59E0B', fontSize: '11px' }}>
                  {roomConstraint.invalidTileKeys.size} outside
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Theme toggle + Room Size + Generate + Layouts */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-all cursor-pointer"
          style={{
            backgroundColor: 'var(--c-bg-input)',
            border: '1px solid var(--c-border)',
            color: 'var(--c-text-icon)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)';
            e.currentTarget.style.borderColor = 'var(--c-accent-border)';
            e.currentTarget.style.color = 'var(--c-accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--c-bg-input)';
            e.currentTarget.style.borderColor = 'var(--c-border)';
            e.currentTarget.style.color = 'var(--c-text-icon)';
          }}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button
          onClick={onOpenRoomSize}
          title="Set room size constraint"
          className="flex items-center gap-2 px-3 py-2 rounded transition-all cursor-pointer"
          style={{
            backgroundColor: roomConstraint?.enabled ? 'rgba(0,212,255,0.1)' : 'var(--c-bg-input)',
            border: `1px solid ${roomConstraint?.enabled ? 'rgba(0,212,255,0.3)' : 'var(--c-border)'}`,
            color: roomConstraint?.enabled ? '#00D4FF' : 'var(--c-text-icon)',
            fontSize: '13px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = roomConstraint?.enabled ? 'rgba(0,212,255,0.18)' : 'var(--c-accent-bg-hover)';
            e.currentTarget.style.borderColor = roomConstraint?.enabled ? 'rgba(0,212,255,0.5)' : 'var(--c-accent-border)';
            e.currentTarget.style.color = roomConstraint?.enabled ? '#00D4FF' : 'var(--c-accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = roomConstraint?.enabled ? 'rgba(0,212,255,0.1)' : 'var(--c-bg-input)';
            e.currentTarget.style.borderColor = roomConstraint?.enabled ? 'rgba(0,212,255,0.3)' : 'var(--c-border)';
            e.currentTarget.style.color = roomConstraint?.enabled ? '#00D4FF' : 'var(--c-text-icon)';
          }}
        >
          <Ruler size={14} />
        </button>

        <button
          onClick={onOpenGenerate}
          className="flex items-center gap-2 px-4 py-2 rounded transition-all cursor-pointer"
          style={{
            backgroundColor: 'var(--c-accent-bg)',
            border: '1px solid var(--c-accent-border)',
            color: 'var(--c-accent)',
            fontSize: '13px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)';
            e.currentTarget.style.borderColor = 'var(--c-accent-border-strong)';
            e.currentTarget.style.boxShadow = `0 0 12px ${isDark ? 'rgba(0,212,255,0.15)' : 'rgba(0,153,204,0.12)'}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--c-accent-bg)';
            e.currentTarget.style.borderColor = 'var(--c-accent-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          ✨ Generate
        </button>

        <button
          onClick={onOpenLayouts}
          className="flex items-center gap-2 px-4 py-2 rounded transition-all cursor-pointer"
          style={{
            backgroundColor: 'var(--c-accent)',
            color: isDark ? '#0F1115' : '#FFFFFF',
            fontSize: '13px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-accent-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-accent)'; }}
        >
          <Layers size={14} />
          Layouts
        </button>
      </div>
    </div>
  );
}