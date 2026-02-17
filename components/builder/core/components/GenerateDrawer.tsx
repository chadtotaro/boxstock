import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Loader2, Plus, Minus, ChevronDown, Lock } from 'lucide-react';
import { useTheme } from '../hooks/useThemeContext';
import { TILE_ORDER } from '@/data/tile-data';
import { TILE_DEFINITIONS } from '@/data/tile-data';
import { TileRenderer } from './TileRenderer';
import type { TileType } from '@/types/builder';
import { generateThreeLayouts, type GeneratedLayout, type FootprintSize } from './LayoutResultsOverlay';
import { Grid2x2Plus, Trash2 } from 'lucide-react';

interface GenerateDrawerProps {
  open: boolean;
  onClose: () => void;
  onShowResults: (layouts: GeneratedLayout[], inventory: Record<TileType, number>, footprint: FootprintSize) => void;
  onPlaceInventory: (inventory: Record<TileType, number>) => void;
  onRemoveDumpedTiles: () => void;
  hasDumpedTiles: boolean;
}

const INITIAL_INVENTORY: Record<TileType, number> = {
  'straight': 12,
  'corner': 8,
  'inside-corner': 4,
  'inside-corner-45': 2,
  'bump': 4,
  'diagonal': 2,
  'blank': 2,
};

export function GenerateDrawer({ open, onClose, onShowResults, onPlaceInventory, onRemoveDumpedTiles, hasDumpedTiles }: GenerateDrawerProps) {
  const { isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [inventory, setInventory] = useState<Record<TileType, number>>({ ...INITIAL_INVENTORY });
  const [complexity, setComplexity] = useState(50);
  const [flowStyle, setFlowStyle] = useState(50);
  const [footprint, setFootprint] = useState<FootprintSize>('medium');
  const [footprintOpen, setFootprintOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Animation
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!footprintOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFootprintOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [footprintOpen]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const totalTiles = Object.values(inventory).reduce((s, v) => s + v, 0);

  const adjustCount = (type: TileType, delta: number) => {
    setInventory((prev) => ({
      ...prev,
      [type]: Math.max(0, prev[type] + delta),
    }));
  };

  const handleGenerate = () => {
    if (generating) return;
    setGenerating(true);
    setTimeout(() => {
      const results = generateThreeLayouts(inventory, footprint);
      setGenerating(false);
      handleClose();
      // Small delay to let drawer close animation start before overlay opens
      setTimeout(() => onShowResults(results, inventory, footprint), 100);
    }, 1000);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{
          backgroundColor: visible ? 'rgba(0,0,0,0.2)' : 'transparent',
          transitionDuration: '280ms',
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col overflow-hidden"
        style={{
          width: 380,
          backgroundColor: 'var(--c-bg)',
          borderLeft: '1px solid var(--c-border)',
          boxShadow: `-12px 0 40px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.12)'}`,
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--c-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05))'
                  : 'linear-gradient(135deg, rgba(0,153,204,0.15), rgba(0,153,204,0.05))',
                border: '1px solid var(--c-accent-border)',
              }}
            >
              <Sparkles size={16} style={{ color: 'var(--c-accent)' }} />
            </div>
            <h2 style={{ color: 'var(--c-text)', fontSize: '15px', lineHeight: '1.2' }}>
              Generate Layout
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--c-text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--c-bg-hover)';
              e.currentTarget.style.color = 'var(--c-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--c-text-muted)';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable content ────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--c-scroll-thumb) transparent' }}
        >
          {/* ── Prompt ───────────────────────────────────────── */}
          <div className="px-5 pt-5 pb-4">
            <SectionLabel>Prompt</SectionLabel>
            <div
              className="relative rounded-lg overflow-hidden transition-all"
              style={{
                border: `1px solid ${prompt ? 'var(--c-accent-border-strong)' : 'var(--c-border)'}`,
                backgroundColor: 'var(--c-bg-input)',
              }}
            >
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Example: I have 12 straights and 8 corners. Make a tight technical course."
                rows={3}
                className="w-full bg-transparent outline-none resize-none p-3"
                style={{
                  color: 'var(--c-text)',
                  fontSize: '13px',
                  lineHeight: '1.5',
                }}
              />
              {prompt && (
                <button
                  onClick={() => setPrompt('')}
                  className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded transition-colors cursor-pointer"
                  style={{ color: 'var(--c-text-dim)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--c-text-muted)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--c-text-dim)';
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <Divider />

          {/* ── Inventory ────────────────────────────────────── */}
          <div className="px-5 pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <SectionLabel noMargin>Tile Inventory</SectionLabel>
              <span
                className="px-2 py-0.5 rounded"
                style={{
                  backgroundColor: 'var(--c-accent-bg)',
                  color: 'var(--c-accent)',
                  fontSize: '11px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {totalTiles} tiles
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {TILE_ORDER.map((tileType) => (
                <InventoryRow
                  key={tileType}
                  tileType={tileType}
                  count={inventory[tileType]}
                  onAdjust={(d) => adjustCount(tileType, d)}
                />
              ))}
            </div>

            {/* ── Place / Remove inventory buttons ──────────────── */}
            <div className="flex flex-col gap-2 mt-3">
              <button
                onClick={() => { if (totalTiles > 0) onPlaceInventory(inventory); }}
                disabled={totalTiles === 0}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-default"
                style={{
                  backgroundColor: 'var(--c-accent-bg)',
                  border: '1px solid var(--c-accent-border)',
                  color: 'var(--c-accent)',
                  fontSize: '12px',
                }}
                onMouseEnter={(e) => {
                  if (totalTiles > 0) {
                    e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)';
                    e.currentTarget.style.borderColor = 'var(--c-accent-border-strong)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--c-accent-bg)';
                  e.currentTarget.style.borderColor = 'var(--c-accent-border)';
                }}
              >
                <Grid2x2Plus size={13} />
                Place inventory on canvas
              </button>

              {hasDumpedTiles && (
                <button
                  onClick={onRemoveDumpedTiles}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg transition-colors cursor-pointer"
                  style={{
                    backgroundColor: 'var(--c-error-bg)',
                    border: '1px solid var(--c-error-border)',
                    color: 'var(--c-error)',
                    fontSize: '12px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--c-error-bg)';
                    e.currentTarget.style.borderColor = 'var(--c-error)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--c-error-bg)';
                    e.currentTarget.style.borderColor = 'var(--c-error-border)';
                  }}
                >
                  <Trash2 size={13} />
                  Remove dumped tiles
                </button>
              )}
            </div>
          </div>

          <Divider />

          {/* ── Layout Controls ──────────────────────────────── */}
          <div className="px-5 pt-4 pb-4">
            <SectionLabel>Layout Controls</SectionLabel>

            {/* Complexity */}
            <div className="mb-4">
              <SliderControl
                label="Complexity"
                labelLeft="Low"
                labelRight="High"
                value={complexity}
                onChange={setComplexity}
              />
            </div>

            {/* Technical ↔ Flowing */}
            <div className="mb-4">
              <SliderControl
                label="Technical ↔ Flowing"
                labelLeft="Technical"
                labelRight="Flowing"
                value={flowStyle}
                onChange={setFlowStyle}
              />
            </div>

            {/* Footprint Size */}
            <div className="mb-4">
              <span
                className="block mb-2"
                style={{ color: 'var(--c-text)', fontSize: '12px' }}
              >
                Footprint Size
              </span>
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setFootprintOpen(!footprintOpen)}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-lg transition-colors cursor-pointer"
                  style={{
                    backgroundColor: 'var(--c-bg-input)',
                    border: `1px solid ${footprintOpen ? 'var(--c-accent-border-strong)' : 'var(--c-border)'}`,
                    color: 'var(--c-text)',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>{footprint}</span>
                  <ChevronDown
                    size={14}
                    style={{
                      color: 'var(--c-text-muted)',
                      transform: footprintOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 150ms ease',
                    }}
                  />
                </button>
                {footprintOpen && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-10"
                    style={{
                      backgroundColor: 'var(--c-menu-bg)',
                      border: '1px solid var(--c-menu-border)',
                      boxShadow: `0 8px 24px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.12)'}`,
                    }}
                  >
                    {(['small', 'medium', 'large'] as FootprintSize[]).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          setFootprint(opt);
                          setFootprintOpen(false);
                        }}
                        className="flex items-center w-full px-3 py-2 transition-colors cursor-pointer"
                        style={{
                          backgroundColor: footprint === opt ? 'var(--c-accent-bg)' : 'transparent',
                          color: footprint === opt ? 'var(--c-accent)' : 'var(--c-text)',
                          fontSize: '13px',
                          textTransform: 'capitalize',
                        }}
                        onMouseEnter={(e) => {
                          if (footprint !== opt)
                            e.currentTarget.style.backgroundColor = 'var(--c-bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                          if (footprint !== opt)
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Closed Loop Required */}
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{
                backgroundColor: 'var(--c-accent-bg-subtle)',
                border: '1px solid var(--c-accent-border)',
              }}
            >
              <div className="flex items-center gap-2">
                <Lock size={13} style={{ color: 'var(--c-accent)' }} />
                <span style={{ color: 'var(--c-text)', fontSize: '12px' }}>
                  Closed Loop Required
                </span>
              </div>
              <LockedToggle />
            </div>
          </div>
        </div>

        {/* ── Footer / Primary Button ────────────────────────── */}
        <div
          className="px-5 py-4 shrink-0"
          style={{ borderTop: '1px solid var(--c-border)' }}
        >
          {generating ? (
            <div className="flex flex-col items-center gap-2.5 py-1">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--c-accent)' }} />
                <span style={{ color: 'var(--c-accent)', fontSize: '13px' }}>
                  Generating...
                </span>
              </div>
              <span style={{ color: 'var(--c-text-muted)', fontSize: '11px', textAlign: 'center' }}>
                Generating 3 valid closed loop layouts...
              </span>
              <div
                className="w-full rounded-full overflow-hidden mt-0.5"
                style={{ height: 3, backgroundColor: 'var(--c-bg-input)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: 'var(--c-accent)',
                    animation: 'genProgress 1s ease-in-out forwards',
                  }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={totalTiles === 0}
              className="flex items-center justify-center gap-2 w-full h-11 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-default"
              style={{
                background:
                  totalTiles === 0
                    ? 'var(--c-bg-input)'
                    : isDark
                      ? 'linear-gradient(135deg, #00D4FF, #0099CC)'
                      : 'linear-gradient(135deg, #00B8F0, #0088BB)',
                color:
                  totalTiles === 0
                    ? 'var(--c-text-muted)'
                    : isDark
                      ? '#0F1115'
                      : '#FFFFFF',
                fontSize: '13px',
                border: totalTiles === 0 ? '1px solid var(--c-border)' : 'none',
                boxShadow:
                  totalTiles === 0
                    ? 'none'
                    : `0 4px 16px ${isDark ? 'rgba(0,212,255,0.25)' : 'rgba(0,153,204,0.25)'}`,
              }}
              onMouseEnter={(e) => {
                if (totalTiles > 0) {
                  e.currentTarget.style.boxShadow = `0 6px 24px ${isDark ? 'rgba(0,212,255,0.35)' : 'rgba(0,153,204,0.35)'}`;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (totalTiles > 0) {
                  e.currentTarget.style.boxShadow = `0 4px 16px ${isDark ? 'rgba(0,212,255,0.25)' : 'rgba(0,153,204,0.25)'}`;
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <Sparkles size={14} />
              Generate 3 Layouts
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes genProgress {
          0% { width: 0%; }
          30% { width: 35%; }
          60% { width: 65%; }
          90% { width: 92%; }
          100% { width: 100%; }
        }
      `}</style>
    </>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function SectionLabel({
  children,
  noMargin,
}: {
  children: React.ReactNode;
  noMargin?: boolean;
}) {
  return (
    <span
      className={`block ${noMargin ? '' : 'mb-3'}`}
      style={{
        color: 'var(--c-text-secondary)',
        fontSize: '12px',
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </span>
  );
}

function Divider() {
  return (
    <div className="px-5">
      <div style={{ height: 1, backgroundColor: 'var(--c-border)' }} />
    </div>
  );
}

/* ── Inventory row ───────────────────────────────────────────────── */

function InventoryRow({
  tileType,
  count,
  onAdjust,
}: {
  tileType: TileType;
  count: number;
  onAdjust: (delta: number) => void;
}) {
  const def = TILE_DEFINITIONS[tileType];

  return (
    <div
      className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg"
      style={{
        backgroundColor: 'var(--c-bg-input)',
        border: '1px solid var(--c-border-subtle)',
      }}
    >
      {/* Tile preview */}
      <div className="shrink-0 rounded overflow-hidden" style={{ width: 28, height: 28 }}>
        <TileRenderer tileType={tileType} rotation={0} size={28} />
      </div>

      {/* Label */}
      <span
        className="flex-1 min-w-0 truncate"
        style={{ color: 'var(--c-text)', fontSize: '12px' }}
      >
        {def.label}
      </span>

      {/* Counter */}
      <div className="flex items-center gap-0">
        <CounterButton onClick={() => onAdjust(-1)} disabled={count === 0}>
          <Minus size={12} />
        </CounterButton>
        <span
          className="flex items-center justify-center"
          style={{
            minWidth: 28,
            color: count === 0 ? 'var(--c-text-dim)' : 'var(--c-text)',
            fontSize: '13px',
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'center',
          }}
        >
          {count}
        </span>
        <CounterButton onClick={() => onAdjust(1)}>
          <Plus size={12} />
        </CounterButton>
      </div>
    </div>
  );
}

function CounterButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center w-6 h-6 rounded transition-colors cursor-pointer disabled:cursor-default"
      style={{
        backgroundColor: 'transparent',
        color: disabled ? 'var(--c-text-dim)' : 'var(--c-text-muted)',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-hover)';
          e.currentTarget.style.color = 'var(--c-accent)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = disabled ? 'var(--c-text-dim)' : 'var(--c-text-muted)';
      }}
    >
      {children}
    </button>
  );
}

/* ── Slider control ──────────────────────────────────────────────── */

function SliderControl({
  label,
  labelLeft,
  labelRight,
  value,
  onChange,
}: {
  label: string;
  labelLeft: string;
  labelRight: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <span className="block mb-2" style={{ color: 'var(--c-text)', fontSize: '12px' }}>
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: 'var(--c-accent)', height: 4 }}
      />
      <div className="flex items-center justify-between mt-1">
        <span style={{ color: 'var(--c-text-dim)', fontSize: '10px' }}>{labelLeft}</span>
        <span style={{ color: 'var(--c-text-dim)', fontSize: '10px' }}>{labelRight}</span>
      </div>
    </div>
  );
}

/* ── Locked toggle (always on) ───────────────────────────────────── */

function LockedToggle() {
  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{
        width: 36,
        height: 20,
        backgroundColor: 'var(--c-accent)',
        opacity: 0.85,
        cursor: 'not-allowed',
      }}
    >
      <div
        className="absolute top-0.5 rounded-full"
        style={{
          width: 16,
          height: 16,
          backgroundColor:
            document.documentElement.getAttribute('data-theme') === 'dark'
              ? '#0F1115'
              : '#FFFFFF',
          transform: 'translateX(17px)',
        }}
      />
    </div>
  );
}