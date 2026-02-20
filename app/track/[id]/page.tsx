'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { renderThumbnail } from '@/components/builder/core/lib/thumbnail-renderer'
import type { PlacedTile } from '@/types/builder'

interface SharedTrack {
  id: string
  layout_name: string
  tiles: Record<string, PlacedTile>
  created_at: string
}

export default function TrackPage() {
  const { id } = useParams<{ id: string }>()
  const [track, setTrack] = useState<SharedTrack | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('shared_tracks')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        setError(true)
      } else {
        setTrack(data)
      }
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!track) return
    const dataUrl = renderThumbnail({ tiles: track.tiles, width: 1200, height: 800 })
    if (!dataUrl || !canvasRef.current) return
    const img = new Image()
    img.onload = () => {
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx || !canvasRef.current) return
      ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height)
    }
    img.src = dataUrl
  }, [track])

  const handleDownload = () => {
    if (!track) return
    const dataUrl = renderThumbnail({ tiles: track.tiles, width: 2400, height: 1600 })
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${track.layout_name}.png`
    a.click()
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tileCount = track ? Object.keys(track.tiles).length : 0
  const dateStr = track
    ? new Date(track.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#0b0f14' }}>
        <div style={{ color: '#555f7a', fontSize: '14px' }}>Loading track...</div>
      </div>
    )
  }

  if (error || !track) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ backgroundColor: '#0b0f14' }}>
        <div style={{ color: '#FE5757', fontSize: '18px' }}>Track not found</div>
        <a href="/builder" style={{ color: '#555f7a', fontSize: '13px' }}>← Back to builder</a>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#0b0f14' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded"
            style={{ backgroundColor: 'rgba(254,87,87,0.15)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FE5757" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Mini-Z Builder</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: copied ? '#22C55E' : 'rgba(255,255,255,0.6)',
              fontSize: '12px',
            }}
          >
            {copied ? '✓ Copied!' : '🔗 Copy Link'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
            style={{
              backgroundColor: '#FE5757',
              color: '#fff',
              fontSize: '12px',
              border: 'none',
            }}
          >
            ↓ Download PNG
          </button>
          <a
            href="/builder"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all"
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '12px',
              textDecoration: 'none',
            }}
          >
            Open Builder →
          </a>
        </div>
      </div>

      {/* Track display */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            maxWidth: 800,
            width: '100%',
          }}
        >
          <canvas
            ref={canvasRef}
            width={1200}
            height={800}
            style={{ width: '100%', height: 'auto', display: 'block', backgroundColor: '#0b0f14' }}
          />
        </div>

        {/* Track info */}
        <div className="flex flex-col items-center gap-2">
          <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 600 }}>{track.layout_name}</h1>
          <div className="flex items-center gap-4" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>
            <span>{tileCount} tiles</span>
            <span>·</span>
            <span>Shared {dateStr}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
