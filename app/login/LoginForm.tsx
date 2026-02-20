'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
      if (data.session) router.replace('/builder')
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
      else router.replace('/builder')
    }
    setLoading(false)
  }

  const toggleLabel = isSignUp ? 'Already have an account?' : 'New here? Sign up'

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F2F3F5' }}>
      <div className="w-full max-w-sm rounded-2xl p-8" style={{ backgroundColor: '#FFFFFF', border: '1px solid #D4D7DD', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-2 mb-8">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: 'rgba(254,87,87,0.12)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FE5757" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#1A1D23' }}>boxstock</span>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1A1D23', marginBottom: '4px' }}>
          {isSignUp ? 'Create an account' : 'Welcome back'}
        </h1>
        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>
          {isSignUp ? 'Start building your first track.' : 'Sign in to your account.'}
        </p>
        <div className="flex flex-col gap-1 mb-3">
          <label style={{ fontSize: '12px', fontWeight: 500, color: '#3A3F4A' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #D4D7DD', fontSize: '14px', color: '#1A1D23', backgroundColor: '#F2F3F5', outline: 'none' }}
          />
        </div>
        <div className="flex flex-col gap-1 mb-5">
          <label style={{ fontSize: '12px', fontWeight: 500, color: '#3A3F4A' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #D4D7DD', fontSize: '14px', color: '#1A1D23', backgroundColor: '#F2F3F5', outline: 'none' }}
          />
        </div>
        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(220,38,38,0.08)', color: '#DC2626', fontSize: '13px' }}>
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(21,128,61,0.08)', color: '#15803D', fontSize: '13px' }}>
            {message}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-2.5 rounded-lg font-medium transition-all cursor-pointer"
          style={{ backgroundColor: '#FE5757', color: '#fff', fontSize: '14px', border: 'none', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
        </button>
        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#6B7280' }}>
          {toggleLabel}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null) }}
            style={{ color: '#FE5757', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}
