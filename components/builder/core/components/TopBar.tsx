import { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Check, Loader2, Share2, Download, Copy, Sparkles } from 'lucide-react';
import Icon from '@mdi/react';
import { mdiRulerSquare, mdiGrid, mdiClose, mdiUndo, mdiRedo } from '@mdi/js';
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

const iconBtnBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 36, height: 36, borderRadius: 8,
  backgroundColor: '#e9e9eb', border: '1px solid #d5d7de',
  cursor: 'pointer', color: '#4D5358', flexShrink: 0,
};

const iconBtnDisabled: React.CSSProperties = {
  ...iconBtnBase, opacity: 0.4, cursor: 'default',
};

const chipStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  height: 36, padding: '0 8px', borderRadius: 8,
  backgroundColor: '#e9e9eb', border: '1px solid #d5d7de',
  fontSize: 12, color: '#000', whiteSpace: 'nowrap', flexShrink: 0,
};

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
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title="Share or download track"
        style={{ ...iconBtnBase, backgroundColor: open ? '#d5d7de' : '#e9e9eb' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#d5d7de'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = open ? '#d5d7de' : '#e9e9eb'; }}
      >
        <Share2 size={16} />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 44, backgroundColor: '#fff', border: '1px solid #e2e2e2', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: 200, zIndex: 50, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid #e2e2e2' }}>
            <span style={{ color: '#888', fontSize: 10, letterSpacing: '0.08em', fontWeight: 600 }}>SHARE & EXPORT</span>
          </div>
          <button onClick={() => { onShare('download'); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(254,87,87,0.12)' }}>
              <Download size={13} style={{ color: '#FE5757' }} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, color: '#000' }}>Download PNG</div>
              <div style={{ fontSize: 11, color: '#888' }}>High-res, print ready</div>
            </div>
          </button>
          <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }} onMouseEnter={(e) => { if (!copied) e.currentTarget.style.backgroundColor = '#f5f5f5'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, backgroundColor: copied ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.12)' }}>
              {copied ? <Check size={13} style={{ color: '#22C55E' }} /> : <Copy size={13} style={{ color: '#818CF8' }} />}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, color: copied ? '#22C55E' : '#000' }}>{copied ? 'Copied!' : 'Share Track'}</div>
              <div style={{ fontSize: 11, color: '#888' }}>Copies a shareable URL</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar({
  layoutName, onLayoutNameChange, saveStatus, onOpenGenerate,
  onUndo, onRedo, canUndo, canRedo, tileCount, trackValidation,
  onClearAll, roomConstraint, onOpenRoomSize, onDisableRoomConstraint,
  onShare, onSignOut, userEmail,
}: TopBarProps) {
  const { isDark, toggle } = useTheme();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(layoutName ?? '');
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
    <div style={{ display: 'flex', alignItems: 'center', height: 56, padding: '0 16px', gap: 12, backgroundColor: '#f2f3f5', borderBottom: '1px solid #cbcdd4', flexShrink: 0 }}>

      {/* LEFT: track name */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, minWidth: 0, maxWidth: 280 }}>
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
            style={{ background: 'transparent', border: 'none', borderBottom: '2px solid #0fc4ba', color: '#000', fontSize: 16, fontWeight: 500, fontFamily: 'Inter, sans-serif', outline: 'none', width: Math.max(140, editValue.length * 10 + 24), padding: '0 2px 2px' }}
          />
        ) : (
          <h1 onClick={() => setEditing(true)} title="Click to rename" style={{ margin: 0, color: '#000', fontSize: 16, fontWeight: 500, fontFamily: 'Inter, sans-serif', textDecoration: 'underline', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
            {layoutName}
          </h1>
        )}
      </div>

      {/* CENTER: saved + tile chip + room chip */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {saveStatus === 'saving'
            ? <Loader2 size={11} style={{ color: '#888' }} className="animate-spin" />
            : <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: saveStatus === 'saved' ? '#4dc16a' : '#f59e0b' }} />
          }
          <span style={{ fontSize: 12, fontWeight: 500, fontFamily: 'Inter, sans-serif', color: saveStatus === 'saved' ? '#4dc16a' : saveStatus === 'saving' ? '#888' : '#f59e0b' }}>
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
          </span>
        </div>

        {confirmClear ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>Clear {tileCount} tile{tileCount !== 1 ? 's' : ''}?</span>
            <button onClick={() => { onClearAll(); setConfirmClear(false); }} style={{ padding: '2px 8px', borderRadius: 6, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 11, cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}>Yes, clear</button>
            <button onClick={() => setConfirmClear(false)} style={{ padding: '2px 8px', borderRadius: 6, backgroundColor: 'transparent', border: '1px solid #d5d7de', color: '#888', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
          </div>
        ) : (
          <div style={chipStyle}>
            <Icon path={mdiGrid} size={0.7} style={{ color: '#4D5358' }} />
            <span>{tileCount}</span>
            <button onClick={() => setConfirmClear(true)} title="Clear all tiles" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4D5358', display: 'flex', alignItems: 'center', padding: '0 0 0 2px' }}>
              <Icon path={mdiClose} size={0.55} />
            </button>
          </div>
        )}

        {roomConstraint && roomConstraint.enabled ? (
          <div style={chipStyle}>
            <Icon path={mdiRulerSquare} size={0.7} style={{ color: '#4D5358' }} />
            <button onClick={onOpenRoomSize ?? (() => {})} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#000', fontSize: 12, padding: 0, whiteSpace: 'nowrap' }}>
              {roomConstraint.widthValue} x {roomConstraint.heightValue} {roomConstraint.unit}
            </button>
            <button onClick={onDisableRoomConstraint ?? (() => {})} title="Clear room constraint" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4D5358', display: 'flex', alignItems: 'center', padding: '0 0 0 2px' }}>
              <Icon path={mdiClose} size={0.55} />
            </button>
          </div>
        ) : (
          <button onClick={onOpenRoomSize ?? (() => {})} title="Set room size" style={iconBtnBase} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#d5d7de'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#e9e9eb'; }}>
            <Icon path={mdiRulerSquare} size={0.7} />
          </button>
        )}
      </div>

      {/* RIGHT: undo, redo, generate, theme, share */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={canUndo ? iconBtnBase : iconBtnDisabled} onMouseEnter={(e) => { if (canUndo) e.currentTarget.style.backgroundColor = '#d5d7de'; }} onMouseLeave={(e) => { if (canUndo) e.currentTarget.style.backgroundColor = '#e9e9eb'; }}>
          <Icon path={mdiUndo} size={0.7} />
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" style={canRedo ? iconBtnBase : iconBtnDisabled} onMouseEnter={(e) => { if (canRedo) e.currentTarget.style.backgroundColor = '#d5d7de'; }} onMouseLeave={(e) => { if (canRedo) e.currentTarget.style.backgroundColor = '#e9e9eb'; }}>
          <Icon path={mdiRedo} size={0.7} />
        </button>
        <button onClick={onOpenGenerate} title="AI Generate layout" style={iconBtnBase} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#d5d7de'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#e9e9eb'; }}>
          <Sparkles size={16} />
        </button>
        <button onClick={toggle} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'} style={iconBtnBase} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#d5d7de'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#e9e9eb'; }}>
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <SharePopover onShare={onShare} />
      </div>
    </div>
  );
}