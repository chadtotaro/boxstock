'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const BoxstockLogo = () => (
  <img src="/boxstock-logo.svg" alt="Boxstock" style={{ height: '18px' }} />
)

export default function GlobalHeader() {
  const [user, setUser] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const pathname = usePathname()
  if (pathname === "/login") return null

  const initial = user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <header
      style={{
        backgroundColor: '#0A0C10',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        flexShrink: 0,
      }}
    >
      {/* Left: Home icon (builder only) + Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginLeft: -20 }}>
        {pathname === '/builder' && (
          <>
            <a href="/" title="Dashboard" style={{
              width: 49, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#312919', textDecoration: 'none', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dbb762" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </a>
            <div style={{ width: 1, height: 44, backgroundColor: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
          </>
        )}
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', paddingLeft: pathname === '/builder' ? 16 : 20 }}>
          <BoxstockLogo />
        </a>
      </div>

      {/* Right: Bell + User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Bell — non-functional for now */}
        <button
          style={{
            width: '32px', height: '32px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>

        {/* User avatar + dropdown */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setOpen(!open)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              padding: '4px 8px 4px 4px',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #00C6C1, #F2C364)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: '#0A0C10',
            }}>
              {initial}
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {open && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)',
              backgroundColor: '#14171D',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              padding: '8px',
              minWidth: '200px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              zIndex: 1001,
            }}>
              <div style={{
                padding: '8px 10px 10px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                marginBottom: '6px',
              }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '2px' }}>Signed in as</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 500, wordBreak: 'break-all' }}>
                  {user?.email}
                </div>
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#FE5757',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(254,87,87,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
