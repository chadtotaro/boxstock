import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Sparkles, RotateCcw, ArrowRight, CornerDownRight, Minus as DashIcon, Gauge, Loader2, AlertTriangle, Check } from 'lucide-react';
import { useTheme } from '../hooks/useThemeContext';
import type { PlacedTile, TileType } from '@/types/builder';
import type { GeneratedLayout } from '../lib/layout-generator';

export type { GeneratedLayout };
export { generateThreeLayouts } from '../lib/layout-generator';
export type { FootprintSize } from '../lib/layout-generator';

interface LayoutResultsOverlayProps {
  layouts: GeneratedLayout[];
  hasExistingTiles: boolean;
  onSelect: (tiles: Record<string, PlacedTile>, style: string) => void;
  onRegenerate: () => void;
  onClose: () => void;
}

/* ── Tile colors for thumbnail ────────────────────────────────────── */

const TILE_COLORS: Record<TileType, { dark: string; light: string }> = {
  'straight':         { dark: '#4B9CDB', light: '#3B8BC9' },
  'corner':           { dark: '#FE5757', light: '#E84545' },
  'inside-corner':    { dark: '#FE5757', light: '#E84545' },
  'inside-corner-45': { dark: '#FF8844', light: '#E87733' },
  'bump':             { dark: '#8B6CDB', light: '#7759C9' },
  'diagonal':         { dark: '#FF8844', light: '#E87733' },
  'blank':            { dark: '#555B68', light: '#9CA3AF' },
};

const DIFFICULTY_COLOR: Record<string, string> = {
  Low: '#4ADE80',
  Medium: '#FBBF24',
  High: '#F87171',
};

/* ── Component ────────────────────────────────────────────────────── */

export function LayoutResultsOverlay({
  layouts,
  hasExistingTiles,
  onSelect,
  onRegenerate,
  onClose,
}: LayoutResultsOverlayProps) {
  const { isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [cardsVisible, setCardsVisible] = useState(false);
  const [confirmLayout, setConfirmLayout] = useState<GeneratedLayout | null>(null);

  // Entrance animation
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    const t = setTimeout(() => setCardsVisible(true), 120);
    return () => clearTimeout(t);
  }, []);

  // Reset card visibility when layouts change (after regeneration)
  useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
    setCardsVisible(false);
    const t = setTimeout(() => setCardsVisible(true), 80);
    return () => clearTimeout(t);
  }, [layouts]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 320);
  }, [onClose]);

  const handleSelectIntent = (layout: GeneratedLayout) => {
    if (hasExistingTiles) {
      setConfirmLayout(layout);
    } else {
      commitSelect(layout);
    }
  };

  const commitSelect = (layout: GeneratedLayout) => {
    setConfirmLayout(null);
    setVisible(false);
    setTimeout(() => onSelect(layout.tiles, layout.style), 320);
  };

  const handleRegenerate = () => {
    if (regenerating) return;
    setRegenerating(true);
    setCardsVisible(false);
    setTimeout(() => {
      onRegenerate();
      setRegenerating(false);
    }, 1000);
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex flex-col">
        {/* Backdrop */}
        <div
          className="absolute inset-0 transition-opacity"
          style={{
            backgroundColor: isDark ? 'rgba(8,10,14,0.82)' : 'rgba(0,0,0,0.55)',
            opacity: visible ? 1 : 0,
            transitionDuration: '320ms',
          }}
          onClick={handleClose}
        />

        {/* Panel */}
        <div
          className="relative flex flex-col mt-auto w-full"
          style={{
            maxHeight: '85vh',
            backgroundColor: 'var(--c-bg)',
            borderTop: '1px solid var(--c-border)',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            boxShadow: `0 -16px 60px ${isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.18)'}`,
            transform: visible ? 'translateY(0)' : 'translateY(100%)',
            opacity: visible ? 1 : 0,
            transition: 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms ease',
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-0 shrink-0">
            <div
              className="rounded-full"
              style={{ width: 36, height: 4, backgroundColor: 'var(--c-border)' }}
            />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between px-8 pt-4 pb-5 shrink-0">
            <div>
              <div className="flex items-center gap-2.5">
                <Sparkles size={18} style={{ color: 'var(--c-accent)' }} />
                <h2 style={{ color: 'var(--c-text)', fontSize: '18px', lineHeight: '1.2' }}>
                  Choose a Layout
                </h2>
              </div>
              <p
                className="mt-1.5"
                style={{ color: 'var(--c-text-muted)', fontSize: '13px', marginLeft: 30 }}
              >
                All options are fully valid closed loops.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors cursor-pointer shrink-0 mt-0.5"
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
              <X size={18} />
            </button>
          </div>

          {/* Cards */}
          <div
            className="flex-1 overflow-y-auto px-8 pb-4"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--c-scroll-thumb) transparent' }}
          >
            {regenerating ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2
                  size={28}
                  className="animate-spin"
                  style={{ color: 'var(--c-accent)' }}
                />
                <span style={{ color: 'var(--c-accent)', fontSize: '14px' }}>
                  Regenerating layouts...
                </span>
                <span style={{ color: 'var(--c-text-muted)', fontSize: '12px' }}>
                  Generating 3 valid closed loop layouts...
                </span>
                <div
                  className="rounded-full overflow-hidden mt-1"
                  style={{ width: 200, height: 3, backgroundColor: 'var(--c-bg-input)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: 'var(--c-accent)',
                      animation: 'regenProgress 1s ease-in-out forwards',
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-5">
                  {layouts.map((layout, idx) => (
                    <LayoutCard
                      key={layout.id}
                      layout={layout}
                      isDark={isDark}
                      animDelay={idx * 120}
                      visible={cardsVisible}
                      onSelect={() => handleSelectIntent(layout)}
                    />
                  ))}
                </div>

                {/* Regenerate button */}
                <div className="flex justify-center pt-5 pb-3">
                  <button
                    onClick={handleRegenerate}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all cursor-pointer"
                    style={{
                      backgroundColor: 'var(--c-bg-input)',
                      border: '1px solid var(--c-border)',
                      color: 'var(--c-text-muted)',
                      fontSize: '13px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--c-accent-border)';
                      e.currentTarget.style.color = 'var(--c-accent)';
                      e.currentTarget.style.backgroundColor = 'var(--c-accent-bg)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--c-border)';
                      e.currentTarget.style.color = 'var(--c-text-muted)';
                      e.currentTarget.style.backgroundColor = 'var(--c-bg-input)';
                    }}
                  >
                    <RotateCcw size={14} />
                    Regenerate All
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirmLayout && (
        <ConfirmDialog
          isDark={isDark}
          style={confirmLayout.style}
          onConfirm={() => commitSelect(confirmLayout)}
          onCancel={() => setConfirmLayout(null)}
        />
      )}

      <style>{`
        @keyframes regenProgress {
          0% { width: 0%; }
          30% { width: 35%; }
          60% { width: 65%; }
          90% { width: 92%; }
          100% { width: 100%; }
        }
        @keyframes cardReveal {
          0% { opacity: 0; transform: translateY(16px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}

/* ── Confirmation Dialog ──────────────────────────────────────────── */

function ConfirmDialog({
  isDark,
  style,
  onConfirm,
  onCancel,
}: {
  isDark: boolean;
  style: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [vis, setVis] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVis(true));
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div
        className="absolute inset-0 transition-opacity"
        style={{
          backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.35)',
          opacity: vis ? 1 : 0,
          transitionDuration: '200ms',
        }}
        onClick={onCancel}
      />
      <div
        className="relative flex flex-col rounded-xl overflow-hidden"
        style={{
          width: 380,
          backgroundColor: 'var(--c-bg)',
          border: '1px solid var(--c-border)',
          boxShadow: `0 16px 48px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.18)'}`,
          transform: vis ? 'scale(1)' : 'scale(0.95)',
          opacity: vis ? 1 : 0,
          transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease',
        }}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{
                backgroundColor: isDark ? 'rgba(251,191,36,0.12)' : 'rgba(217,119,6,0.1)',
              }}
            >
              <AlertTriangle size={16} style={{ color: '#FBBF24' }} />
            </div>
            <span style={{ color: 'var(--c-text)', fontSize: '15px' }}>
              Replace current layout?
            </span>
          </div>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '13px', lineHeight: '1.55' }}>
            This will clear your existing tiles and apply the
            <span style={{ color: 'var(--c-accent)' }}> {style} </span>
            layout. This action can be undone.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-5 py-4"
          style={{ borderTop: '1px solid var(--c-border)' }}
        >
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center py-2.5 rounded-lg transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--c-bg-input)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-text-muted)',
              fontSize: '13px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--c-card-hover-border)';
              e.currentTarget.style.color = 'var(--c-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--c-border)';
              e.currentTarget.style.color = 'var(--c-text-muted)';
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center py-2.5 rounded-lg transition-all cursor-pointer"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #00D4FF, #0099CC)'
                : 'linear-gradient(135deg, #00B8F0, #0088BB)',
              color: isDark ? '#0F1115' : '#FFFFFF',
              fontSize: '13px',
              boxShadow: `0 3px 12px ${isDark ? 'rgba(0,212,255,0.2)' : 'rgba(0,153,204,0.2)'}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = `0 5px 18px ${isDark ? 'rgba(0,212,255,0.3)' : 'rgba(0,153,204,0.25)'}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = `0 3px 12px ${isDark ? 'rgba(0,212,255,0.2)' : 'rgba(0,153,204,0.2)'}`;
            }}
          >
            Replace Layout
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Layout Card ──────────────────────────────────────────────────── */

function LayoutCard({
  layout,
  isDark,
  animDelay,
  visible,
  onSelect,
}: {
  layout: GeneratedLayout;
  isDark: boolean;
  animDelay: number;
  visible: boolean;
  onSelect: () => void;
}) {
  const diffColor = DIFFICULTY_COLOR[layout.stats.difficulty] || '#6B7280';
  const [hovered, setHovered] = useState(false);

  const electricBlue = isDark ? '#00B8FF' : '#0099DD';
  const hoverShadow = isDark
    ? '0 12px 36px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,184,255,0.15)'
    : '0 12px 36px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,153,221,0.1)';
  const restShadow = 'none';

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--c-bg-panel)',
        border: `1px solid ${hovered ? electricBlue : 'var(--c-border)'}`,
        opacity: visible ? 1 : 0,
        transform: visible
          ? hovered ? 'translateY(-3px) scale(1)' : 'translateY(0) scale(1)'
          : 'translateY(16px) scale(0.97)',
        boxShadow: hovered ? hoverShadow : restShadow,
        transition: `opacity 280ms ease ${animDelay}ms, transform 320ms cubic-bezier(0.16,1,0.3,1) ${visible ? '0ms' : `${animDelay}ms`}, border-color 180ms ease, box-shadow 220ms ease`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div
        className="relative"
        style={{
          height: 200,
          backgroundColor: isDark ? '#0A0C10' : '#E2E4E8',
          borderBottom: '1px solid var(--c-border)',
        }}
      >
        <LayoutThumbnail
          tiles={layout.tiles}
          isDark={isDark}
          animate={visible}
          baseDelay={animDelay + 200}
        />

        {/* Valid Closed Loop badge */}
        <div
          className="absolute flex items-center gap-1 rounded-full"
          style={{
            top: 10,
            right: 10,
            padding: '3px 8px 3px 5px',
            backgroundColor: isDark ? 'rgba(34,197,94,0.14)' : 'rgba(22,163,74,0.1)',
            border: `1px solid ${isDark ? 'rgba(34,197,94,0.25)' : 'rgba(22,163,74,0.2)'}`,
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1)' : 'scale(0.85)',
            transition: `opacity 250ms ease ${animDelay + 350}ms, transform 250ms cubic-bezier(0.16,1,0.3,1) ${animDelay + 350}ms`,
          }}
        >
          <Check
            size={10}
            strokeWidth={2.5}
            style={{ color: isDark ? '#4ADE80' : '#16A34A' }}
          />
          <span
            style={{
              fontSize: '10px',
              color: isDark ? '#4ADE80' : '#16A34A',
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            Valid Closed Loop
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4">
        {/* Label + style */}
        <div className="mb-3">
          <span style={{ color: 'var(--c-text)', fontSize: '15px' }}>
            {layout.label}
          </span>
          <span
            className="block mt-1"
            style={{ color: 'var(--c-accent)', fontSize: '12px', letterSpacing: '0.01em' }}
          >
            {layout.style}
          </span>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-2 mb-4">
          <StatRow icon={<DashIcon size={12} />} label="Total tiles" value={String(layout.stats.totalTiles)} />
          <StatRow icon={<CornerDownRight size={12} />} label="Turn count" value={String(layout.stats.turnCount)} />
          <StatRow icon={<ArrowRight size={12} />} label="Longest straight" value={String(layout.stats.longestStraight)} />
          <StatRow icon={<Gauge size={12} />} label="Est. difficulty" value={layout.stats.difficulty} valueColor={diffColor} />
        </div>

        {/* CTA */}
        <button
          onClick={onSelect}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg transition-all cursor-pointer mt-auto"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #00D4FF, #0099CC)'
              : 'linear-gradient(135deg, #00B8F0, #0088BB)',
            color: isDark ? '#0F1115' : '#FFFFFF',
            fontSize: '13px',
            boxShadow: `0 3px 12px ${isDark ? 'rgba(0,212,255,0.2)' : 'rgba(0,153,204,0.2)'}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 5px 20px ${isDark ? 'rgba(0,212,255,0.35)' : 'rgba(0,153,204,0.3)'}`;
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = `0 3px 12px ${isDark ? 'rgba(0,212,255,0.2)' : 'rgba(0,153,204,0.2)'}`;
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Use This Layout
        </button>
      </div>
    </div>
  );
}

/* ── Stat row ─────────────────────────────────────────────────────── */

function StatRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2" style={{ color: 'var(--c-text-muted)', fontSize: '12px' }}>
        {icon}
        <span>{label}</span>
      </div>
      <span
        style={{
          color: valueColor || 'var(--c-text)',
          fontSize: '12px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Layout Thumbnail (SVG preview) ───────────────────────────────── */

function LayoutThumbnail({
  tiles,
  isDark,
  animate,
  baseDelay,
}: {
  tiles: Record<string, PlacedTile>;
  isDark: boolean;
  animate: boolean;
  baseDelay: number;
}) {
  const entries = Object.values(tiles);
  const [visibleCount, setVisibleCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!animate || entries.length === 0) {
      setVisibleCount(0);
      return;
    }
    // Wait for the card entrance to finish, then start drawing tiles
    timerRef.current = setTimeout(() => {
      let count = 0;
      const perTile = Math.max(18, Math.min(40, 600 / entries.length));
      const step = () => {
        count++;
        setVisibleCount(count);
        if (count < entries.length) {
          timerRef.current = setTimeout(step, perTile);
        }
      };
      step();
    }, baseDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [animate, entries.length, baseDelay]);

  if (entries.length === 0) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ color: 'var(--c-text-dim)', fontSize: '12px' }}
      >
        Empty
      </div>
    );
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const t of entries) {
    if (t.x < minX) minX = t.x;
    if (t.x > maxX) maxX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.y > maxY) maxY = t.y;
  }

  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  const padding = 24;
  const availW = 340;
  const availH = 200 - padding * 2;
  const cellSize = Math.min(Math.floor(availW / cols), Math.floor(availH / rows), 28);
  const gridW = cols * cellSize;
  const gridH = rows * cellSize;
  const offsetX = (availW - gridW) / 2;
  const offsetY = (200 - gridH) / 2;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 340 200"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0"
    >
      {Array.from({ length: cols + 1 }, (_, i) => (
        <line
          key={`v${i}`}
          x1={offsetX + i * cellSize} y1={offsetY}
          x2={offsetX + i * cellSize} y2={offsetY + gridH}
          stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}
          strokeWidth={0.5}
        />
      ))}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line
          key={`h${i}`}
          x1={offsetX} y1={offsetY + i * cellSize}
          x2={offsetX + gridW} y2={offsetY + i * cellSize}
          stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}
          strokeWidth={0.5}
        />
      ))}
      {entries.map((tile, idx) => {
        const cx = offsetX + (tile.x - minX) * cellSize;
        const cy = offsetY + (tile.y - minY) * cellSize;
        const colors = TILE_COLORS[tile.type];
        const fill = isDark ? colors.dark : colors.light;
        const gap = 1;
        const isVisible = idx < visibleCount;
        const halfCell = cellSize / 2;
        return (
          <g
            key={`${tile.x},${tile.y}`}
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible
                ? 'scale(1)'
                : 'scale(0.6)',
              transformOrigin: `${cx + halfCell}px ${cy + halfCell}px`,
              transition: 'opacity 120ms ease-out, transform 160ms cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <rect
              x={cx + gap} y={cy + gap}
              width={cellSize - gap * 2} height={cellSize - gap * 2}
              rx={2} fill={fill} opacity={0.85}
            />
            <rect
              x={cx + gap + 1} y={cy + gap + 1}
              width={cellSize - gap * 2 - 2}
              height={Math.max(1, (cellSize - gap * 2) * 0.3)}
              rx={1} fill="rgba(255,255,255,0.12)"
            />
          </g>
        );
      })}
    </svg>
  );
}