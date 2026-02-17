import type { TileType } from '@/types/builder';
import type { TileEdgeError } from '../lib/edge-validator';

/**
 * Renders tile graphics using inline SVG/div matching Figma designs.
 * All tiles are drawn at a 144x144 native resolution and scaled to `size`.
 */

interface TileRendererProps {
  tileType: TileType;
  rotation: number;
  size: number;
  selected?: boolean;
  hovered?: boolean;
  edgeErrors?: TileEdgeError[];
  ghost?: boolean;
}

/* ── Individual tile SVGs (native 144x144) ───────────────────────── */

function StraightSVG() {
  return (
    <svg width="144" height="144" viewBox="0 0 144 144" fill="none" style={{ display: 'block', width: '100%', height: '100%' }} preserveAspectRatio="none">
      <rect width="144" height="144" fill="var(--c-tile-dark)" />
      <rect width="144" height="31" fill="#EBE6E6" />
      <circle cx="14" cy="16" r="4" fill="#636060" />
      <circle cx="130" cy="16" r="4" fill="#636060" />
    </svg>
  );
}

function CornerDiv() {
  return (
    <div style={{ width: 144, height: 144, position: 'relative', background: 'var(--c-canvas-bg)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 144, height: 144, backgroundColor: '#fe5757', borderBottomRightRadius: 500 }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: 116, height: 116, backgroundColor: 'var(--c-tile-dark)', borderBottomRightRadius: 500 }} />
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ position: 'absolute', left: 10, top: 124 }}><circle cx="5" cy="5" r="5" fill="#D9D9D9" /></svg>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ position: 'absolute', left: 85, top: 87 }}><circle cx="5" cy="5" r="5" fill="#D9D9D9" /></svg>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ position: 'absolute', left: 125, top: 9 }}><circle cx="5" cy="5" r="5" fill="#D9D9D9" /></svg>
    </div>
  );
}

function InsideCornerSVG() {
  return (
    <svg width="144" height="144" viewBox="0 0 144 144" fill="none" style={{ display: 'block', width: '100%', height: '100%' }} preserveAspectRatio="none">
      <rect width="144" height="144" fill="var(--c-tile-dark)" />
      <path d="M0 0H31V0C31 17.1208 17.1208 31 0 31V31V0Z" fill="#FE5757" />
      <circle cx="13" cy="13" r="5" fill="#D9D9D9" />
    </svg>
  );
}

function InsideCorner45SVG() {
  return (
    <svg width="144" height="144" viewBox="0 0 144 144" fill="none" style={{ display: 'block', width: '100%', height: '100%' }} preserveAspectRatio="none">
      <rect width="144" height="144" fill="var(--c-tile-dark)" />
      <path d="M31 0H0V31L31 0Z" fill="#FE5757" />
      <circle cx="10" cy="9" r="5" fill="#D9D9D9" />
    </svg>
  );
}

function BumpSVG() {
  return (
    <svg width="144" height="144" viewBox="0 0 144 144" fill="none" overflow="hidden" style={{ display: 'block', width: '100%', height: '100%' }} preserveAspectRatio="none">
      <rect width="144" height="144" fill="var(--c-tile-dark)" />
      <rect width="144" height="31" fill="#EBE6E6" />
      <circle cx="14" cy="16" r="4" fill="#636060" />
      <circle cx="130" cy="16" r="4" fill="#636060" />
      <circle cx="72" cy="-7" r="54" fill="#EBE6E6" />
      <circle cx="72" cy="31" r="4" fill="#636060" />
    </svg>
  );
}

function DiagonalSVG() {
  return (
    <svg width="144" height="144" viewBox="0 0 144 144" fill="none" style={{ display: 'block', width: '100%', height: '100%' }} preserveAspectRatio="none">
      <rect width="144" height="144" fill="var(--c-canvas-bg)" />
      <path d="M0 0H144L0 144V0Z" fill="var(--c-tile-dark)" />
      <path d="M144 0.5L0 144V120L119.5 0.5H144Z" fill="#FE5757" />
    </svg>
  );
}

function BlankDiv() {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--c-tile-dark)' }} />
  );
}

/* ── Tile content wrapper (scales 144->size, applies rotation) ───── */

const TILE_COMPONENTS: Record<TileType, React.FC> = {
  'straight': StraightSVG,
  'corner': CornerDiv,
  'inside-corner': InsideCornerSVG,
  'inside-corner-45': InsideCorner45SVG,
  'bump': BumpSVG,
  'diagonal': DiagonalSVG,
  'blank': BlankDiv,
};

const NEEDS_SCALING: Record<TileType, boolean> = {
  'straight': false,
  'corner': true,
  'inside-corner': false,
  'inside-corner-45': false,
  'bump': false,
  'diagonal': false,
  'blank': false,
};

export function TileRenderer({
  tileType,
  rotation,
  size,
  selected = false,
  hovered = false,
  edgeErrors = [],
  ghost = false,
}: TileRendererProps) {
  const Component = TILE_COMPONENTS[tileType];
  const needsScaling = NEEDS_SCALING[tileType];
  const scale = size / 144;

  return (
    <div
      className="relative overflow-hidden"
      style={{ width: size, height: size, opacity: ghost ? 0.55 : 1 }}
    >
      {/* Background tint for interaction states */}
      {(selected || hovered || ghost) && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: ghost
              ? 'var(--c-accent-bg-hover)'
              : selected
                ? 'var(--c-accent-bg-subtle)'
                : 'var(--c-accent-bg-subtle)',
            zIndex: 0,
          }}
        />
      )}

      {/* Tile graphic */}
      <div
        className="absolute inset-0"
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'center center',
          transition: ghost ? 'none' : 'transform 0.15s ease',
          zIndex: 1,
        }}
      >
        {needsScaling ? (
          <div style={{ width: 144, height: 144, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
            <Component />
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%' }}>
            <Component />
          </div>
        )}
      </div>

      {/* Dashed grid border overlay */}
      <div
        className="absolute inset-0 border border-dashed pointer-events-none"
        style={{ borderColor: 'var(--c-border-dashed)', zIndex: 2 }}
      />

      {/* Hover highlight border */}
      {hovered && !selected && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ border: '1px solid var(--c-accent-border)', zIndex: 3 }}
        />
      )}

      {/* Edge error indicators */}
      {edgeErrors.length > 0 && (
        <svg
          width={size} height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 4 }}
        >
          {edgeErrors.map((err) => {
            const isIncompat = err.type === 'incompatible';
            const color = isIncompat ? '#EF4444' : '#F59E0B'; // red for incompatible, orange for lane break
            const glowColor = isIncompat ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)';
            const t = 3; // line thickness
            const m = 6; // margin from edge

            // Draw a line along the affected edge
            let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
            switch (err.direction) {
              case 'N': x1 = m; y1 = t / 2; x2 = size - m; y2 = t / 2; break;
              case 'S': x1 = m; y1 = size - t / 2; x2 = size - m; y2 = size - t / 2; break;
              case 'E': x1 = size - t / 2; y1 = m; x2 = size - t / 2; y2 = size - m; break;
              case 'W': x1 = t / 2; y1 = m; x2 = t / 2; y2 = size - m; break;
            }

            return (
              <g key={`edge-${err.direction}`}>
                {/* Glow */}
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={glowColor}
                  strokeWidth={t + 4}
                  strokeLinecap="round"
                />
                {/* Main line */}
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={color}
                  strokeWidth={t}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 4px ${color})` }}
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* Edge error tooltip hover zones */}
      {edgeErrors.length > 0 && edgeErrors.map((err) => {
        const dirLabel = { N: 'North', E: 'East', S: 'South', W: 'West' }[err.direction];
        const message = err.type === 'incompatible'
          ? `Incompatible ${dirLabel} edge — adjacent tile has a mismatched lane count`
          : `Lane break on ${dirLabel} edge — lane continuity is interrupted`;

        const hitZone = 12;
        let style: React.CSSProperties;
        switch (err.direction) {
          case 'N': style = { top: 0, left: 0, right: 0, height: hitZone }; break;
          case 'S': style = { bottom: 0, left: 0, right: 0, height: hitZone }; break;
          case 'E': style = { top: 0, right: 0, bottom: 0, width: hitZone }; break;
          case 'W': style = { top: 0, left: 0, bottom: 0, width: hitZone }; break;
        }

        return (
          <div
            key={`tooltip-${err.direction}`}
            title={message}
            className="absolute cursor-help"
            style={{ ...style, zIndex: 6, pointerEvents: 'auto' }}
          />
        );
      })}

      {/* Selection glow outline */}
      {selected && (
        <>
          <div className="absolute pointer-events-none" style={{ inset: -1, border: '3px solid var(--c-accent-border)', zIndex: 5 }} />
          <div className="absolute pointer-events-none" style={{ inset: 1, border: '1.5px solid var(--c-accent)', filter: 'drop-shadow(0 0 6px var(--c-accent-border-strong))', zIndex: 5 }} />
        </>
      )}
    </div>
  );
}