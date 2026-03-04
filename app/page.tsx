'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Layers, MoreHorizontal, Trash2 } from 'lucide-react';
import Icon from '@mdi/react';
import { mdiGrid } from '@mdi/js';
import { supabase } from '@/lib/supabase';

function RulerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.2 21C4.58333 21 4.0625 20.7875 3.6375 20.3625C3.2125 19.9375 3 19.4167 3 18.8V5.1C3 4.61667 3.225 4.27917 3.675 4.0875C4.125 3.89583 4.51667 3.96667 4.85 4.3L7.1 6.55L5.75 7.9L6.45 8.6L7.8 7.25L10.4 9.85L9.05 11.2L9.75 11.9L11.1 10.55L13.7 13.15L12.35 14.5L13.05 15.2L14.4 13.85L17 16.45L15.65 17.8L16.35 18.5L17.7 17.15L19.7 19.15C20.0333 19.4833 20.1042 19.875 19.9125 20.325C19.7208 20.775 19.3833 21 18.9 21H5.2ZM6 18H14.3L6 9.7V18Z" fill="currentColor"/>
    </svg>
  );
}

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
  return crypto.randomUUID();
}

function TrackCard({ name, tiles, room, thumbnail, onClick, onDelete }: {
  name: string; tiles: number; room?: string; thumbnail?: string; onClick?: () => void; onDelete?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 8,
        overflow: 'visible',
        cursor: onClick ? 'pointer' : 'default',
        border: hovered ? '2px solid #0fc4ba' : '2px solid transparent',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{
        height: 162,
        backgroundColor: 'var(--c-bg, #000)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderRadius: '6px 6px 0 0',
        overflow: 'hidden',
        transition: 'background-color 0.2s',
      }}>
        {thumbnail ? (
          <img src={thumbnail} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <Layers size={40} style={{ color: 'var(--c-text-dim, rgba(255,255,255,0.1))' }} />
        )}
        {onDelete && (
          <div ref={menuRef} style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.6)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff',
                opacity: hovered || menuOpen ? 1 : 0,
                transition: 'opacity 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#fff'; }}
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', top: 32, right: 0,
                backgroundColor: 'var(--c-menu-bg, #1a1f26)',
                border: '1px solid var(--c-menu-border, rgba(255,255,255,0.1))',
                borderRadius: 8,
                boxShadow: '0 8px 24px var(--c-shadow-strong, rgba(0,0,0,0.4))',
                minWidth: 130, zIndex: 50, overflow: 'hidden',
              }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '8px 12px', background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--c-error, #ef4444)', fontSize: 12,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-error-bg, rgba(239,68,68,0.1))'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Trash2 size={13} />Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{
        backgroundColor: 'var(--c-bg-panel, #fff)',
        padding: '12px 14px 16px',
        borderRadius: '0 0 6px 6px',
        transition: 'background-color 0.2s',
      }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 20, color: 'var(--c-text, #000)' }}>{name}</p>
        <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--c-text-muted, #555)' }}>Created by: radical_mannt</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--c-text, #000)' }}>
            <Icon path={mdiGrid} size={0.65} />{tiles}
          </span>
          {room && room !== '-- x --' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--c-text, #000)' }}>
              <RulerIcon size={16} />{room}
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
  const [boxstockLayouts, setBoxstockLayouts] = useState<Layout[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) {
        router.replace('/login');
        return;
      }
      const [{ data: userRows }, { data: boxstockRows }] = await Promise.all([
        supabase.from('layouts').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
        supabase.from('layouts').select('*').eq('user_id', '30ece52b-5a87-4805-ad83-03d5d858e9d1').order('updated_at', { ascending: false }),
      ]);
      const mapRow = (r: any) => ({ ...r, thumbnailDataUrl: r.thumbnail_data_url, roomConstraint: r.room_constraint });
      setLayouts((userRows ?? []).map(mapRow));
      setBoxstockLayouts((boxstockRows ?? []).map(mapRow));
      setLoading(false);
    });
  }, []);

  const handleOpen = (id: string) => {
    localStorage.setItem('miniz-current-layout-id', id);
    router.push('/builder');
  };

  const handleOpenBoxstock = async (layoutId: string) => {
    const layout = boxstockLayouts.find(l => l.id === layoutId);
    if (!layout) return;
    const { data, error } = await supabase
      .from('shared_tracks')
      .insert({ layout_name: layout.name, tiles: layout.tiles })
      .select('id')
      .single();
    if (!error && data) router.push('/track/' + data.id);
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

  const handleDelete = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('layouts').delete().eq('id', id).eq('user_id', session.user.id);
    setLayouts(prev => prev.filter(l => l.id !== id));
  };

  const displayed = showAll ? layouts : layouts.slice(0, 5);
  const tileCount = (l: Layout) => Object.keys(l.tiles || {}).length;
  const roomStr = (l: Layout) => {
    const rc = l.roomConstraint as any;
    return rc?.enabled ? `${rc.widthValue}' x ${rc.heightValue}'` : '-- x --';
  };

  if (loading) return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--c-bg, #090707)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background-color 0.2s',
    }}>
      <p style={{ color: 'var(--c-text-muted, rgba(255,255,255,0.4))', fontSize: 16 }}>Loading...</p>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--c-bg, #090707)',
      color: 'var(--c-text, #fff)',
      fontFamily: 'Inter, system-ui, sans-serif',
      overflowY: 'auto',
      transition: 'background-color 0.2s, color 0.2s',
    }}>

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '40px 40px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40 }}>
          <button onClick={handleNew} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 28px', borderRadius: 8,
            background: 'linear-gradient(90deg, #0fc4ba, #dbb762)',
            color: '#2e2919', fontWeight: 700, fontSize: 15,
            border: 'none', cursor: 'pointer', letterSpacing: '0.5px',
          }}>
            <Plus size={16} />
            NEW TRACK
          </button>
        </div>

        <section style={{ marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--c-text, #fff)' }}>Your Tracks</h2>
            {layouts.length > 5 && (
              <button onClick={() => setShowAll(v => !v)} style={{
                background: 'none', border: 'none', color: '#0fc4ba', fontSize: 14, cursor: 'pointer',
              }}>
                {showAll ? 'Show less' : `See all ${layouts.length}`}
              </button>
            )}
          </div>
          {layouts.length === 0 ? (
            <div onClick={handleNew} style={{
              border: '2px dashed var(--c-border-dashed, rgba(255,255,255,0.15))',
              borderRadius: 8, padding: '60px 24px', textAlign: 'center', cursor: 'pointer',
              color: 'var(--c-text-muted, rgba(255,255,255,0.3))',
            }}>
              <Plus size={36} style={{ margin: '0 auto 12px' }} />
              <p style={{ margin: 0, fontSize: 15 }}>No tracks yet — create your first one</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
              {displayed.map(l => (
                <TrackCard key={l.id} name={l.name} tiles={tileCount(l)} room={roomStr(l)} thumbnail={l.thumbnailDataUrl} onClick={() => handleOpen(l.id)} onDelete={() => handleDelete(l.id)} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 20px', color: 'var(--c-text, #fff)' }}>Boxstock Tracks</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
            {boxstockLayouts.length === 0 ? (
              <p style={{ color: 'var(--c-text-muted, rgba(255,255,255,0.3))', fontSize: 14 }}>No Boxstock tracks yet.</p>
            ) : boxstockLayouts.map(l => (
              <TrackCard key={l.id} name={l.name} tiles={tileCount(l)} room={roomStr(l)} thumbnail={l.thumbnailDataUrl} onClick={() => handleOpenBoxstock(l.id)} />
            ))}
          </div>
        </section>
      </div>

      <footer style={{
        borderTop: '1px solid var(--c-border-subtle, rgba(255,255,255,0.08))',
        padding: '24px 40px',
        textAlign: 'center',
        color: 'var(--c-text-muted, rgba(255,255,255,0.3))',
        fontSize: 12,
        transition: 'border-color 0.2s, color 0.2s',
      }}>
        © 2025 Boxstock. All rights reserved.
      </footer>
    </div>
  );
}
