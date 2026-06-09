'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loginWithBiometric, isBiometricAvailable } from '@/lib/auth/webauthn'
import { Fingerprint, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

function LoginForm() {
  const params = useSearchParams()
  const next   = params.get('next') || '/'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [bioLoading, setBioLoading] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [bioAvail, setBioAvail] = useState(false)

  useEffect(() => { setBioAvail(isBiometricAvailable()) }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }
    window.location.href = next
  }

  async function handleBiometric() {
    setBioLoading(true)
    const ok = await loginWithBiometric()
    if (ok) {
      window.location.href = next
    } else {
      toast.error('Biometric login failed — use email and password.')
    }
    setBioLoading(false)
  }

  return (
    <div className="min-h-screen bg-[var(--c-bg)] flex flex-col items-center justify-center px-6">

      {/* Logo mark */}
      <div className="mb-10 text-center select-none">
        <div className="w-14 h-14 brand-gradient rounded-xl flex items-center
          justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/25">
          <span className="text-white text-xl font-bold tracking-tight">A</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--fg-1)] tracking-tight">ACS·OS</h1>
        <p className="text-sm text-[var(--fg-3)] mt-0.5">Advanced Computer System</p>
      </div>

      {/* Form */}
      <div className="w-full max-w-sm">
        <form onSubmit={handleLogin} className="space-y-4">

          <div>
            <label className="label">Email</label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              className="input" placeholder="you@acs.in"
              required autoComplete="email"
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="input" placeholder="••••••••"
              required autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm
              bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50
              rounded-lg px-3 py-2.5">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading
              ? <><Loader2 size={16} className="animate-spin" /> Signing in…</>
              : 'Sign In'}
          </button>
        </form>

        {bioAvail && (
          <button
            onClick={handleBiometric}
            disabled={bioLoading}
            className="mt-3 w-full flex items-center justify-center gap-2.5
              rounded-lg border border-[var(--c-border-2)] bg-[var(--c-card)]
              text-[var(--fg-2)] py-3 px-5 text-sm font-medium
              hover:bg-[var(--c-card-alt)] transition-colors"
          >
            {bioLoading
              ? <Loader2 size={17} className="animate-spin" />
              : <Fingerprint size={17} className="text-brand-500" />}
            Login with Fingerprint / Face ID
          </button>
        )}

        {/* Demo bypass */}
        <button
          onClick={() => {
            document.cookie = 'acs-demo=owner; path=/; max-age=86400'
            window.location.href = '/'
          }}
          className="mt-3 w-full flex items-center justify-center gap-2
            rounded-lg border border-amber-300/40 dark:border-amber-700/40
            bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400
            py-2.5 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-950/40
            transition-colors"
        >
          Demo Login — no Supabase needed
        </button>
      </div>

      <p className="mt-12 text-xs text-[var(--fg-3)]">Burdwan · West Bengal</p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--c-bg)]" />}>
      <LoginForm />
    </Suspense>
  )
}
