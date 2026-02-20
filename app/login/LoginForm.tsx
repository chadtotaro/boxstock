'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const BoxstockLogo = () => (
  <svg width="140" height="15" viewBox="0 0 175 19" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.712 17.92L15.792 0.420013H24.416C25.7787 0.420013 26.7587 0.653347 27.356 1.12001C27.9533 1.58668 28.252 2.30535 28.252 3.27601C28.252 4.76935 27.916 5.96401 27.244 6.86001C26.5907 7.73735 25.8533 8.27868 25.032 8.48401L25.004 8.65201C25.9187 8.82001 26.5627 9.20268 26.936 9.80001C27.328 10.3973 27.524 11.1253 27.524 11.984C27.524 13.0293 27.328 14.0093 26.936 14.924C26.5627 15.82 25.984 16.548 25.2 17.108C24.4347 17.6493 23.464 17.92 22.288 17.92H12.712ZM14.7 1.68001L2.856 0.420013H14.924L14.7 1.68001ZM14.252 4.36801L2.38 3.10801H14.448L14.252 4.36801ZM19.964 6.86001H21.616C22.4373 6.86001 22.624 6.30001 22.904 5.04001C22.904 4.79735 22.848 4.61068 22.736 4.48001C22.624 4.33068 22.4187 4.25601 22.12 4.25601H20.44L19.964 6.86001ZM13.776 7.05601L1.904 5.79601H14L13.776 7.05601ZM13.3 9.74401L1.428 8.48401H13.524L13.3 9.74401ZM18.732 13.804H20.804C21.308 13.804 21.672 13.608 21.896 13.216C22.12 12.824 22.232 12.3667 22.232 11.844C22.232 11.5827 22.1667 11.368 22.036 11.2C21.9053 11.032 21.672 10.948 21.336 10.948H19.236L18.732 13.804ZM12.824 12.432L0.952 11.172H13.048L12.824 12.432ZM12.348 15.12L0.476 13.86H12.572L12.348 15.12ZM11.872 17.836L0 16.576H12.096L11.872 17.836Z" fill="url(#logo_gradient)"/>
    <defs>
      <linearGradient id="logo_gradient" x1="7" y1="7.92001" x2="174" y2="7.92001" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00C6C1"/>
        <stop offset="1" stopColor="#F2C364" stopOpacity="0.933333"/>
      </linearGradient>
    </defs>
  </svg>
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
          {error && <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(220olor: '#DC2626', fontSize: '13px' }}>{error}</div>}
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
