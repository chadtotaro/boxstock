import { useState, useRef, useEffect } from 'react';
import { Undo2, Redo2, Check, Loader2, Moon, Sun, CircleCheck, CircleAlert, AlertTriangle, Trash2, Ruler, X, Share2, Download, Copy, Sparkles, Pencil } from 'lucide-react';
import { useTheme } from '../hooks/useThemeContext';
import type { SaveStatus } from '@/types/builder';
import type { TrackValidation } from '../lib/edge-validator';
import type { RoomConstraint } from '@/types/builder';

interface TopBarProps {
  layoutName: string;
  onLayoutNameChange: (name: string) => void;
  saveStatus: SaveStatus;
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
  onShare: (action: 'download' | 'copy') => void | Promise<void>;
  onSignOut: () => void;
  userEmail?: string;
}

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5" style={{ color: 'var(--c-text-muted)', fontSize: '12px' }}>
        <Loader2 size={11} className="animate-spin" />
        Saving...
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1.5" style={{ color: 'var(--c-success)', fontSize: '12px' }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: 'var(--c-success)',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        Saved
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5" style={{ color: 'var(--c-warning)', fontSize: '12px' }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: 'var(--c-warning)',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      Unsaved
    </span>
  );
}

/* ── Right-side icon button ──────────────────────────────────────── */

function ActionIconButton({
  onClick,
  tooltip,
  active,
  children,
}: {
  onClick: () => void;
  tooltip: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className="flex items-center justify-center w-9 h-9 rounded-lg transition-all cursor-pointer"
      style={{
        backgroundColor: active ? 'var(--c-accent-bg-hover)' : 'var(--c-bg-input)',
        border: `1px solid ${active ? 'var(--c-accent-border)' : 'var(--c-border)'}`,
        color: active ? 'var(--c-accent)' : 'var(--c-text-icon)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)';
        e.currentTarget.style.borderColor = 'var(--c-accent-border)';
        e.currentTarget.style.color = 'var(--c-accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = active ? 'var(--c-accent-bg-hover)' : 'var(--c-bg-input)';
        e.currentTarget.style.borderColor = active ? 'var(--c-accent-border)' : 'var(--c-border)';
        e.currentTarget.style.color = active ? 'var(--c-accent)' : 'var(--c-text-icon)';
      }}
    >
      {children}
    </button>
  );
}

/* ── Share Popover ───────────────────────────────────────────────── */

function SharePopover({ onShare }: { onShare: (action: 'download' | 'copy') => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleCopy = () => {
    onShare('copy');
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1500);
  };

  return (
    <div ref={ref} className="relative">
      <ActionIconButton onClick={() => setOpen(!open)} tooltip="Share or download track" active={open}>
        <Share2 size={15} />
      </ActionIconButton>

      {open && (
        <div
          className="absolute right-0 top-11 rounded-xl overflow-hidden z-50"
          style={{
            backgroundColor: 'var(--c-menu-bg)',
            border: '1px solid var(--c-menu-border)',
            boxShadow: '0 8px 32px var(--c-shadow-strong)',
            minWidth: 200,
          }}
        >
          <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--c-menu-border)' }}>
            <span style={{ color: 'var(--c-text-muted)', fontSize: '10px', letterSpacing: '0.08em', fontWeight: 600 }}>SHARE & EXPORT</span>
          </div>

          <button
            onClick={() => { onShare('download'); setOpen(false); }}
            className="flex items-center gap-3 w-full px-4 py-3 transition-colors cursor-pointer"
            style={{ color: 'var(--c-text)', fontSize: '13px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ backgroundColor: 'rgba(254,87,87,0.12)' }}>
              <Download size={13} style={{ color: '#FE5757' }} />
            </div>
            <div className="text-left">
              <div style={{ fontSize: '13px', color: 'var(--c-text)' }}>Download PNG</div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>High-res, print ready</div>
            </div>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-3 w-full px-4 py-3 transition-colors cursor-pointer"
            style={{ color: 'var(--c-text)', fontSize: '13px' }}
            onMouseEnter={(e) => { if (!copied) e.currentTarget.style.backgroundColor = 'var(--c-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ backgroundColor: copied ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.12)' }}>
              {copied
                ? <Check size={13} style={{ color: '#22C55E' }} />
                : <Copy size={13} style={{ color: '#818CF8' }} />
              }
            </div>
            <div className="text-left">
              <div style={{ fontSize: '13px', color: copied ? '#22C55E' : 'var(--c-text)' }}>
                {copied ? 'Copied!' : 'Share Track'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>Copies a shareable URL</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main TopBar ─────────────────────────────────────────────────── */

export function TopBar({
  layoutName,
  onLayoutNameChange,
  saveStatus,
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
  onShare,
  onSignOut,
  userEmail,
}: TopBarProps) {
  const { isDark, toggle } = useTheme();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(layoutName);
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => { setEditValue(layoutName); }, [layoutName]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.select(); }, [editing]);

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
      className="flex items-center px-3 h-14 border-b shrink-0 gap-3"
      style={{ backgroundColor: 'var(--c-bg)', borderColor: 'var(--c-border)' }}
    >
      {/* ── Left: Undo/Redo + Clear + Tile Count ── */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="flex items-center justify-center w-8 h-8 rounded transition-all cursor-pointer disabled:cursor-default"
          style={{ color: canUndo ? 'var(--c-text-icon)' : 'var(--c-text-icon-disabled)', backgroundColor: 'transparent' }}
          onMouseEnter={(e) => { if (canUndo) { e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)'; e.currentTarget.style.color = 'var(--c-accent)'; } }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = canUndo ? 'var(--c-text-icon)' : 'var(--c-text-icon-disabled)'; }}
        >
          <Undo2 size={16} />
        </button>

        {/* Redo */}
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="flex items-center justify-center w-8 h-8 rounded transition-all cursor-pointer disabled:cursor-default"
          style={{ color: canRedo ? 'var(--c-text-icon)' : 'var(--c-text-icon-disabled)', backgroundColor: 'transparent' }}
          onMouseEnter={(e) => { if (canRedo) { e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)'; e.currentTarget.style.color = 'var(--c-accent)'; } }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = canRedo ? 'var(--c-text-icon)' : 'var(--c-text-icon-disabled)'; }}
        >
          <Redo2 size={16} />
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 18, backgroundColor: 'var(--c-border)', margin: '0 4px' }} />

        {/* Clear all tiles */}
        {confirmClear ? (
          <div className="flex items-center gap-1.5">
            <span style={{ color: 'var(--c-text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>
              Clear {tileCount} tile{tileCount !== 1 ? 's' : ''}?
            </span>
            <button
              onClick={() => { onClearAll(); setConfirmClear(false); }}
              className="flex items-center gap-1 px-2 py-0.5 rounded transition-all cursor-pointer"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: '11px' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
            >
              Yes, clear
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="px-2 py-0.5 rounded transition-all cursor-pointer"
              style={{ backgroundColor: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-text-muted)', fontSize: '11px' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            title="Clear all tiles"
            className="flex items-center gap-1.5 px-2 py-1 rounded transition-all cursor-pointer"
            style={{ backgroundColor: 'transparent', color: 'var(--c-text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--c-text-muted)'; }}
          >
            Clear all tiles
          </button>
        )}

        {/* Tile count */}
        {!confirmClear && (
          <span style={{ color: 'var(--c-text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>
            {tileCount} Tile{tileCount !== 1 ? 's' : ''} Placed
          </span>
        )}
        {/* Room size chip */}
        {roomConstraint && roomConstraint.enabled && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ backgroundColor: "var(--c-bg-elevated)", border: "1px solid var(--c-border)", fontSize: "12px", color: "var(--c-text)", whiteSpace: "nowrap" }}>
            <Ruler size={13} style={{ color: "var(--c-text-muted)", flexShrink: 0 }} />
            <button onClick={onOpenRoomSize ?? (() => {})} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text)", fontSize: "12px", padding: 0 }}>
              {roomConstraint.widthValue} x {roomConstraint.heightValue} {roomConstraint.unit}
            </button>
            <button onClick={onDisableRoomConstraint ?? (() => {})} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", fontSize: "14px", padding: "0 0 0 2px", lineHeight: 1, display: "flex", alignItems: "center" }} title="Clear room constraint">x</button>
          </div>
        )}
        )}
      </div>

      {/* ── Center: Editable layout name ── */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-4">
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
            className="outline-none text-center"
            style={{
              backgroundColor: 'transparent',
              borderBottom: '2px solid var(--c-accent)',
              color: 'var(--c-text)',
              fontSize: '15px',
              fontWeight: 600,
              width: Math.max(160, editValue.length * 10 + 24),
              maxWidth: '100%',
              padding: '0 4px 2px',
            }}
          />
        ) : (
          <div
            className="group flex items-center gap-1.5 cursor-pointer"
            onClick={() => setEditing(true)}
            title="Click to rename"
          >
            <Pencil size={12} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" style={{ color: 'var(--c-text)' }} />
            <h1
              className="truncate transition-opacity group-hover:opacity-70"
              style={{
                color: 'var(--c-text)',
                fontSize: '15px',
                fontWeight: 600,
                borderBottom: '1.5px solid var(--c-text)',
                paddingBottom: '1px',
                maxWidth: '100%',
              }}
            >
              {layoutName}
            </h1>
          </div>
        )}
      </div>

      {/* ── Right: Save status + action icons ── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Save status */}
        <SaveStatusIndicator status={saveStatus} />

        {/* Divider */}
        <div style={{ width: 1, height: 18, backgroundColor: 'var(--c-border)', margin: '0 2px' }} />

        {/* AI / Generate */}
        <ActionIconButton onClick={onOpenGenerate} tooltip="AI Generate layout">
          <Sparkles size={15} />
        </ActionIconButton>

        {/* Theme toggle */}
        <ActionIconButton onClick={toggle} tooltip={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </ActionIconButton>
        {/* Room size */}
        <ActionIconButton
          onClick={onOpenRoomSize ?? (() => {})}
          tooltip="Set room size constraint"
        >
          <Ruler size={15} />
        </ActionIconButton>

        {/* Share */}
        <SharePopover onShare={onShare} />
      </div>
    </div>
  );
}
