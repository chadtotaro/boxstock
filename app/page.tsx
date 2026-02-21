'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Clock, Layers } from 'lucide-react';

const LAYOUTS_KEY = 'miniz-layouts';
const CURRENT_ID_KEY = 'miniz-current-layout-id';

interface Layout {
  id: string;
  name: string;
  thumbnailDataUrl?: string;
  lastModified: number;
  tiles: Record<string, unknown>;
  tileSize?: 30 | 50;
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const BOXSTOCK_PICKS = [
  { id: 'pick-1', name: 'Daytona Oval', tiles: 42, tileSize: 50, emoji: '🏁' },
  { id: 'pick-2', name: 'Tokyo Drift', tiles: 38,ileSize: 30, emoji: '🌀' },
  { id: 'pick-3', name: 'Nürburgring Jr.', tiles: 60, tileSize: 50, emoji: '⚡' },
  { id: 'pick-4', name: 'Mini Hairpin', tiles: 24, tileSize: 30, emoji: '🔄' },
];

export default function Dashboard() {
  const router = useRouter();
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    try {
      const data = localStorage.getItem(LAYOUTS_KEY);
      if (data) setLayouts(JSON.parse(data));
    } catch {}
  }, []);

  const handleOpen = (id: string) => {
    localStorage.setItem(CURRENT_ID_KEY, id);
    router.push('/builder');
  };

  const handleNew = () => {
    const newLayout: Layout = {
      id: generateId(),
      name: 'Untitled Layout',
      tiles: {},
      lastModified: Date.now(),
      tileSize: 50,
    };
    const updated = [newLayout, ...layouts];
    localStorage.setItem(LAYOUTS_KEY, JSON.stringify(updated));
    localStorage.setItem(CURRENT_ID_KEY, newLayout.id);
    router.push('/builder');
  };

  const displayed = showAll ? layouts : layouts.slice(0, 5);
  const tileCount = (l: Layout) => Object.keys(l.tiles || {}).length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A0C10', color: '#F0F2F5', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
          <span style={{ color: '#00D4FF' }}>BOX</span>STOCK
        </span>
        <button
          onClick={handleNew}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 8, backgroundColor: '#00D4FF', color: '#0A0C10', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}
        >
          <Plus size={15} />
          New Track
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 32px' }}>
        {/* Your Tracks */}
        <section style={{ marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Your Tracks</h2>
            {layouts.length > 5 && (
              <button onClick={() => setShowAll(v => !v)} style={{ background: 'none', border: 'none', color: '#00D4FF', fontSize: 13, cursor: 'pointer' }}>
                {showAll ? 'Show less' : `See all ${layouts.length}`}
              </button>
            )}
          </div>

          {layouts.length === 0 ? (
            <div
              onClick={handleNew}
              style={{ border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}
            >
              <Plus size={32} style={{ margin: '0 auto 12px' }} />
              <p style={{ margin: 0, fontSize: 14 }}>No tracks yet — create your first one</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {displayed.map(l => (
                <div
                  key={l.id}
                  onClick={() => handleOpen(l.id)}
                  style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#14171D', cursor: 'pointer', overflow: 'hidden', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.4)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                >
                  <div style={{ height: 120, backgroundColor: '#0A0C10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {l.thumbnailDataUrl
                      : <Layers size={32} style={{ color: 'rgba(255,255,255,0.15)' }} />
                    }
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                      <span>{tileCount(l)} tiles · {l.tileSize ?? 50}cm</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} />{timeAgo(l.lastModified)}</span>
                    </div>
                  </div>
                </div>
             ))}
            </div>
          )}
        </section>

        {/* Boxstock Picks */}
        <section>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Boxstock Picks</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Curated layouts from the Boxstock team</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {BOXSTOCK_PICKS.map(p => (
              <div
                key={p.id}
                style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#14171D', overflow: 'hidden', cursor: 'not-allowed', opacity: 0.7 }}
              >
                <div style={{ height: 120, backgroundColor: '#0A0C10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                  {p.emoji}
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 13 }}>{p.name}</p>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                    <span>{p.tiles} tiles · {p.tileSize}cm</span>
                  </div>
                  <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, backgroundColor: 'rgba(0,212,255,0.1)', color: '#00D4FF', padding: '2px 6px', borderRadius: 4 }}>Coming soon</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
