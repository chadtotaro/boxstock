'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const BoxstockLogo = () => (
  <img src="/boxstock-logo.svg" alt="Boxstock" style={{ width: '130px', height: 'auto' }} />
)

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/')
    })
  }, [router])

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.replace('/')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#EBEBED' }}>
      <div className="w-full max-w-sm overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #D4D7DD', borderRadius: '16px', boxShadow: '0 4px 32px rgba(0,0,0,0.1)' }}>
        <div style={{ backgroundColor: '#0A0C10', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BoxstockLogo />
        </div>
        <div style={{ padding: '28px 28px 24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0A0C10', marginBottom: '4px', marginTop: 0 }}>
            {isSignUp ? 'Create an account' : 'Welcome back'}
          </h1>
          <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px', marginTop: 0 }}>
            {isSignUp ? 'Start building your first track.' : 'Sign in to your account.'}
          </p>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#3A3F4A', marginBottom: '6px' }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D4D7DD', fontSize: '14px', color: '#1A1D23', backgroundColor: '#F2F3F5', outline: 'none' }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#3A3F4A', marginBottom: '6px' }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D4D7DD', fontSize: '14px', color: '#1A1D23', backgroundColor: '#F2F3F5', outline: 'none' }} />
          </div>
          {error && <div style={{ marginBottom: "16px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "rgba(220,38,38,0.08)", color: "#DC2626", fontSize: "13px" }}>{error}</div>}
          {message && <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(21,128,61,0.08)', color: '#15803D', fontSize: '13px' }}>{message}</div>}
          <button onClick={handleSubmit} disabled={loading}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#0A0C10', color: '#FFFFFF', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
          <p style={{ textAlign: 'center', marginTop: '16px', marginBottom: 0, fontSize: '13px', color: '#6B7280' }}>
            {isSignUp ? 'Already have an account? ' : 'New here? '}
            <button onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null) }}
              style={{ color: '#0A0C10', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
