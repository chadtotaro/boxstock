'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Layers } from 'lucide-react';
import Icon from '@mdi/react';
import { mdiApps, mdiRulerSquare } from '@mdi/js';
import { supabase } from '@/lib/supabase';

interface Layout {
  id: string;
  name: string;
  thumbnailDataUrl?: string;
  lastModified: number;
  tiles: Record<string, unknown>;
  tileSize?: 30 | 50;
  roomConstraint?: { widthValue: number; heightValue: number; unit: string; enabled: boolean } | null;
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const BOXSTOCK_TRACKS = [
  { id: 'b1', name: 'Laguna Zeca', tiles: 50, room: "10' x 20'" },
  { id: 'b2', name: 'Daytona', tiles: 33, room: '-- x --' },
  { id: 'b3', name: 'Laguna Zeca', tiles: 50, room: "10' x 20'" },
  { id: 'b4', name: 'Laguna Zeca', tiles: 50, room: "10' x 20'" },
  { id: 'b5', name: 'Laguna Zeca', tiles: 50, room: "10' x 20'" },
];

function TrackCard({ name, tiles, room, thumbnail, onClick }: {
  name: string;
  tiles: number;
  room?: string;
  thumbnail?: string;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        border: hovered ? '2px solid #0fc4ba' : '2px solid transparent',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ height: 162, backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {thumbnail
          ? <img src={thumbnail} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <Layers size={40} style={{ color: 'rgba(255,255,255,0.1)' }} />
        }
      </div>
      <div style={{ backgroundColor: '#fff', padding: '12px 14px 16px' }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 20, color: '#000' }}>{name}</p>
        <p style={{ margin: '0 0 10px', fontSize: 11, color: '#555' }}>Created by: radical_mannt</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#000' }}>
            <Icon path={mdiApps} size={0.65} />
            {tiles}
          </span>
          {room && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#000' }}>
              <Icon path={mdiRulerSquare} size={0.65} />
              {room}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: rows } = await supabase
        .from('layouts')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      setLayouts(rows ?? []);
      setLoading(false);
    });
  }, []);

  const handleOpen = (id: string) => {
    localStorage.setItem('miniz-current-layout-id', id);
    router.push('/builder');
  };

  const handleNew = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const newLayout: Layout = {
      id: generateId(),
      name: 'Untitled Layout',
      tiles: {},
      lastModified: Date.now(),
      tileSize: 50,
    };
    await supabase.from('layouts').insert({
      id: newLayout.id,
      user_id: session.user.id,
      name: newLayout.name,
      tiles: {},
      tile_size: 50,
      tags: [],
      updated_at: new Date().toISOString(),
    });
    localStorage.setItem('miniz-current-layout-id', newLayout.id);
    router.push('/builder');
  };

  const displayed = showAll ? layouts : layouts.slice(0, 5);
  const tileCount = (l: Layout) => Object.keys(l.tiles || {}).length;
  const roomStr = (l: Layout) => {
    const rc = l.roomConstraint as any;
    return rc?.enabled ? `${rc.widthValue}' x ${rc.heightValue}'` : '-- x --';
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#090707', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>Loading...</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to top, rgba(218,184,98,0.15), rgba(13,197,188,0.15)) #090707', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', overflowY: 'auto' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '40px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40 }}>
          <button onClick={handleNew} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 8, background: 'linear-gradient(90deg, #0fc4ba, #dbb762)', color: '#2e2919', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', letterSpacing: '0.5px' }}>
            <Plus size={16} />
            NEW TRACK
          </button>
        </div>
        <section style={{ marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Your Tracks</h2>
            {layouts.length > 5 && (
              <button onClick={() => setShowAll(v => !v)} style={{ background: 'none', border: 'none', color: '#0fc4ba', fontSize: 14, cursor: 'pointer' }}>
                {showAll ? 'Show less' : `See all ${layouts.length}`}
              </button>
            )}
          </div>
          {layouts.length === 0 ? (
            <div onClick={handleNew} style={{ border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 8, padding: '60px 24px', textAlign: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
              <Plus size={36} style={{ margin: '0 auto 12px' }} />
              <p style={{ margin: 0, fontSize: 15 }}>No tracks yet — create your first one</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
              {displayed.map(l => (
                <TrackCard key={l.id} name={l.name} tiles={tileCount(l)} room={roomStr(l)} thumbnail={l.thumbnailDataUrl} onClick={() => handleOpen(l.id)} />
              ))}
            </div>
          )}
        </section>
        <section>
          <h2tyle={{ fontSize: 28, fontWeight: 700, margin: '0 0 20px' }}>Boxstock Tracks</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
            {BOXSTOCK_TRACKS.map(t => (
              <TrackCard key={t.id} name={t.name} tiles={t.tiles} room={t.room} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
