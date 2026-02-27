import { useState, useMemo, useEffect } from 'react';
import { X, Ruler, Grid3x3 } from 'lucide-react';
import type { RoomUnit } from '@/types/builder';
import { convertToCm, computeRoomGrid } from '@/types/builder';

interface RoomSizeModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (width: number, height: number, unit: RoomUnit, cols: number, rows: number) => void;
  /** Pre-fill values when editing an existing constraint */
  initialWidth?: number;
  initialHeight?: number;
  initialUnit?: RoomUnit;
  tileSize?: 30 | 50;
  onClear?: () => void;
  hasConstraint?: boolean;
}

const UNIT_LABELS: Record<RoomUnit, string> = { ft: 'Feet', m: 'Meters', cm: 'Centimeters' };
const UNIT_ABBR: Record<RoomUnit, string> = { ft: 'ft', m: 'm', cm: 'cm' };

export function RoomSizeModal({ open, onClose, onApply, initialWidth, initialHeight, initialUnit, tileSize = 50, onClear, hasConstraint }: RoomSizeModalProps) {
  const [widthStr, setWidthStr] = useState(String(initialWidth ?? 10));
  const [heightStr, setHeightStr] = useState(String(initialHeight ?? 8));
  const [unit, setUnit] = useState<RoomUnit>(initialUnit ?? 'ft');

  useEffect(() => {
    if (open) {
      setWidthStr(String(initialWidth ?? 10));
      setHeightStr(String(initialHeight ?? 8));
      setUnit(initialUnit ?? 'ft');
    }
  }, [open]);
  const width = parseFloat(widthStr) || 0;
  const height = parseFloat(heightStr) || 0;

  const preview = useMemo(() => {
    if (width <= 0 || height <= 0) return null;
    const wCm = convertToCm(width, unit);
    const hCm = convertToCm(height, unit);
    return computeRoomGrid(wCm, hCm, tileSize);
  }, [width, height, unit]);

  const isValid = preview !== null && preview.cols >= 1 && preview.rows >= 1;

  const handleApply = () => {
    if (!isValid || !preview) return;
    onApply(width, height, unit, preview.cols, preview.rows);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--c-bg-panel)',
          border: '1px solid var(--c-border)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
          animation: 'roomModalIn 0.2s ease-out',
        }}
      >
        <style>{`
          @keyframes roomModalIn {
            from { opacity: 0; transform: scale(0.95) translateY(8px); }
            to   { opacity: 1; transform: scale(1)    translateY(0); }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ backgroundColor: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}
            >
              <Ruler size={16} style={{ color: '#00D4FF' }} />
            </div>
            <div>
              <h2 style={{ color: 'var(--c-text)', fontSize: '15px' }}>Set Room Size</h2>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>Define physical room dimensions</p>
            </div>
          </div>
          {hasConstraint && onClear && (
            <button
              onClick={() => { onClear(); onClose(); }}
              className="px-4 py-2 rounded-md transition-all cursor-pointer"
              style={{ backgroundColor: 'transparent', border: '1px solid var(--c-error-border)', color: 'var(--c-error)', fontSize: '13px', marginRight: 'auto' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-error-bg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >Clear constraint</button>
          )}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer"
            style={{ color: 'var(--c-text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Unit selector */}
          <div>
            <label style={{ color: 'var(--c-text-muted)', fontSize: '11px', display: 'block', marginBottom: 6 }}>
              Unit
            </label>
            <div className="flex gap-1.5">
              {(['ft', 'm', 'cm'] as RoomUnit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => {
                    const fromCm = (cm: number, toUnit: RoomUnit) => {
                      if (toUnit === 'ft') return Math.round((cm / 30.48) * 10) / 10;
                      if (toUnit === 'm') return Math.round((cm / 100) * 100) / 100;
                      return Math.round(cm);
                    };
                    const wCm = convertToCm(parseFloat(widthStr) || 0, unit);
                    const hCm = convertToCm(parseFloat(heightStr) || 0, unit);
                    setWidthStr(String(fromCm(wCm, u)));
                    setHeightStr(String(fromCm(hCm, u)));
                    setUnit(u);
                  }}
                  className="flex-1 py-1.5 rounded-md transition-all cursor-pointer"
                  style={{
                    fontSize: '12px',
                    backgroundColor: unit === u ? 'rgba(0,212,255,0.12)' : 'var(--c-bg-input)',
                    border: `1px solid ${unit === u ? 'rgba(0,212,255,0.4)' : 'var(--c-border)'}`,
                    color: unit === u ? '#00D4FF' : 'var(--c-text-muted)',
                  }}
                  onMouseEnter={(e) => {
                    if (unit !== u) e.currentTarget.style.borderColor = 'var(--c-accent-border)';
                  }}
                  onMouseLeave={(e) => {
                    if (unit !== u) e.currentTarget.style.borderColor = 'var(--c-border)';
                  }}
                >
                  {UNIT_LABELS[u]}
                </button>
              ))}
            </div>
          </div>

          {/* Width & Height */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={{ color: 'var(--c-text-muted)', fontSize: '11px', display: 'block', marginBottom: 6 }}>
                Width ({UNIT_ABBR[unit]})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={widthStr}
                onChange={(e) => setWidthStr(e.target.value)}
                className="w-full px-3 py-2 rounded-md outline-none"
                style={{
                  backgroundColor: 'var(--c-bg-input)',
                  border: '1px solid var(--c-border)',
                  color: 'var(--c-text)',
                  fontSize: '14px',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#00D4FF'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; }}
              />
            </div>
            <div className="flex-1">
              <label style={{ color: 'var(--c-text-muted)', fontSize: '11px', display: 'block', marginBottom: 6 }}>
                Height ({UNIT_ABBR[unit]})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={heightStr}
                onChange={(e) => setHeightStr(e.target.value)}
                className="w-full px-3 py-2 rounded-md outline-none"
                style={{
                  backgroundColor: 'var(--c-bg-input)',
                  border: '1px solid var(--c-border)',
                  color: 'var(--c-text)',
                  fontSize: '14px',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#00D4FF'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; }}
              />
            </div>
          </div>

          {/* Live preview */}
          <div
            className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg"
            style={{
              backgroundColor: isValid ? 'rgba(0,212,255,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${isValid ? 'rgba(0,212,255,0.15)' : 'rgba(239,68,68,0.15)'}`,
            }}
          >
            <Grid3x3 size={16} style={{ color: isValid ? '#00D4FF' : '#EF4444', flexShrink: 0 }} />
            <div>
              {isValid && preview ? (
                <>
                  <p style={{ color: '#00D4FF', fontSize: '13px' }}>
                    Fits: {preview.cols} cols x {preview.rows} rows tiles
                  </p>
                  <p style={{ color: 'var(--c-text-dim)', fontSize: '11px', marginTop: 2 }}>
                    Each tile = 50cm x 50cm &middot; {preview.cols * preview.rows} cells total
                  </p>
                </>
              ) : (
                <p style={{ color: '#EF4444', fontSize: '13px' }}>
                  {width <= 0 || height <= 0 ? 'Enter valid dimensions' : 'Room too small for tiles (min 50cm)'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3.5"
          style={{ borderTop: '1px solid var(--c-border)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md transition-all cursor-pointer"
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
          <button
            onClick={handleApply}
            disabled={!isValid}
            className="px-5 py-2 rounded-md transition-all cursor-pointer disabled:cursor-default"
            style={{
              backgroundColor: isValid ? 'rgba(0,212,255,0.15)' : 'var(--c-bg-input)',
              border: `1px solid ${isValid ? 'rgba(0,212,255,0.4)' : 'var(--c-border)'}`,
              color: isValid ? '#00D4FF' : 'var(--c-text-muted)',
              fontSize: '13px',
              opacity: isValid ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (isValid) e.currentTarget.style.backgroundColor = 'rgba(0,212,255,0.25)';
            }}
            onMouseLeave={(e) => {
              if (isValid) e.currentTarget.style.backgroundColor = 'rgba(0,212,255,0.15)';
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
