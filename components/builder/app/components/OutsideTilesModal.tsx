import { AlertTriangle } from 'lucide-react';

interface OutsideTilesModalProps {
  open: boolean;
  outsideCount: number;
  onCancel: () => void;
  onRemove: () => void;
  onKeepInvalid: () => void;
}

export function OutsideTilesModal({ open, outsideCount, onCancel, onRemove, onKeepInvalid }: OutsideTilesModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="relative w-full max-w-sm rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--c-bg-panel)',
          border: '1px solid var(--c-border)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
          animation: 'outsideModalIn 0.2s ease-out',
        }}
      >
        <style>{`
          @keyframes outsideModalIn {
            from { opacity: 0; transform: scale(0.95) translateY(8px); }
            to   { opacity: 1; transform: scale(1)    translateY(0); }
          }
        `}</style>

        <div className="px-5 py-5 flex flex-col items-center gap-3 text-center">
          <div
            className="flex items-center justify-center w-11 h-11 rounded-xl"
            style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <AlertTriangle size={20} style={{ color: '#F59E0B' }} />
          </div>
          <h3 style={{ color: 'var(--c-text)', fontSize: '15px' }}>
            Tiles Outside Boundary
          </h3>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '13px', lineHeight: 1.5 }}>
            {outsideCount} tile{outsideCount !== 1 ? 's are' : ' is'} outside the room boundary.
            Choose how to handle {outsideCount !== 1 ? 'them' : 'it'}.
          </p>
        </div>

        <div
          className="flex flex-col gap-2 px-5 pb-5"
        >
          <button
            onClick={onRemove}
            className="w-full py-2.5 rounded-md transition-all cursor-pointer"
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#EF4444',
              fontSize: '13px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.18)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
          >
            Remove outside tiles
          </button>
          <button
            onClick={onKeepInvalid}
            className="w-full py-2.5 rounded-md transition-all cursor-pointer"
            style={{
              backgroundColor: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.25)',
              color: '#F59E0B',
              fontSize: '13px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.18)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.1)'; }}
          >
            Keep but mark invalid
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2.5 rounded-md transition-all cursor-pointer"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--c-border)',
              color: 'var(--c-text-muted)',
              fontSize: '13px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
