'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/builder/core/hooks/useThemeContext'
import type { User } from '@supabase/supabase-js'

const BoxstockLogo = () => (
  <img src="/boxstock-logo.svg" alt="Boxstock" style={{ height: '18px' }} />
)

function ThemeToggle() {
  const { isDark, toggle } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return <div style={{ width: 32, height: 32 }} />
  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: '32px', height: '32px',
        borderRadius: '50%',
        border: '1px solid var(--c-border-subtle, rgba(255,255,255,0.1))',
        backgroundColor: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--c-text-muted, rgba(255,255,255,0.4))',
        transition: 'color 0.2s',
      }}
    >
      {isDark ? (
        /* Sun icon */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        /* Moon icon */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  )
}

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
        backgroundColor: 'var(--c-bg, #0A0C10)',
        borderBottom: '1px solid var(--c-border-subtle, rgba(255,255,255,0.07))',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        flexShrink: 0,
        transition: 'background-color 0.2s, border-color 0.2s',
      }}
    >
      {/* Left: Home icon + Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginLeft: -20 }}>
        <a href="/" title="Dashboard" style={{
            width: 49, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: pathname === '/builder' ? 'var(--c-bg, #0A0C10)' : 'var(--c-bg-elevated, #112322)',
            textDecoration: 'none', flexShrink: 0,
            transition: 'background-color 0.2s',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dbb762" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </a>
          <div style={{ width: 1, height: 44, backgroundColor: 'var(--c-border-subtle, rgba(255,255,255,0.1))', flexShrink: 0 }} />
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', paddingLeft: 16 }}>
          <BoxstockLogo />
        </a>
      </div>

      {/* Right: Theme toggle + Bell + User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ThemeToggle />

        {/* Bell */}
        <button
          style={{
            width: '32px', height: '32px',
            borderRadius: '50%',
            border: '1px solid var(--c-border-subtle, rgba(255,255,255,0.1))',
            backgroundColor: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--c-text-muted, rgba(255,255,255,0.4))',
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
              border: '1px solid var(--c-border-subtle, rgba(255,255,255,0.1))',
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-muted, rgba(255,255,255,0.4))" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {open && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)',
              backgroundColor: 'var(--c-menu-bg, #14171D)',
              border: '1px solid var(--c-menu-border, rgba(255,255,255,0.1))',
              borderRadius: '10px',
              padding: '8px',
              minWidth: '200px',
              boxShadow: '0 8px 32px var(--c-shadow-strong, rgba(0,0,0,0.4))',
              zIndex: 1001,
            }}>
              <div style={{
                padding: '8px 10px 10px',
                borderBottom: '1px solid var(--c-border-subtle, rgba(255,255,255,0.07))',
                marginBottom: '6px',
              }}>
                <div style={{ fontSize: '11px', color: 'var(--c-text-muted, rgba(255,255,255,0.35))', marginBottom: '2px' }}>Signed in as</div>
                <div style={{ fontSize: '13px', color: 'var(--c-text-secondary, rgba(255,255,255,0.8))', fontWeight: 500, wordBreak: 'break-all' }}>
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
                  color: 'var(--c-error, #FE5757)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--c-error-bg, rgba(254,87,87,0.08))')}
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
