'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, LogOut, Sun, Moon, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import SyncIndicator from '@/components/layout/SyncIndicator'
import type { Profile } from '@/types/database'

const STORES: Record<string, string> = {
  '11111111-1111-1111-1111-111111111111': 'ACS',
  '22222222-2222-2222-2222-222222222222': 'Adi Shree Hari',
}

const ROLE_LABELS: Record<string, string> = {
  owner:      'Owner',
  staff:      'Staff',
  technician: 'Technician',
  viewer:     'Viewer',
}

export default function StoreHeader({ profile }: { profile: Profile }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDark,   setIsDark]   = useState(true)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('acs-theme', next ? 'dark' : 'light') } catch {}
  }

  async function handleLogout() {
    document.cookie = 'acs-demo=; path=/; max-age=0'
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const storeName = STORES[profile.store_id] ?? 'ACS·OS'

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 h-12
        bg-[var(--c-card)] border-b border-[var(--c-border)] shadow-[var(--shadow-sm)]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Store picker */}
      <button
        onClick={() => setMenuOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm font-semibold text-[var(--fg-1)]
          hover:text-[var(--fg-2)] transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
        {storeName}
        <ChevronDown size={13} className="text-[var(--fg-3)]" />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-48 z-50 rounded-xl
            bg-[var(--c-card)] border border-[var(--c-border)] shadow-[var(--shadow-md)] py-1 overflow-hidden">
            {Object.entries(STORES).map(([id, name]) => (
              <button key={id}
                className="w-full flex items-center justify-between px-4 py-2.5
                  text-sm text-[var(--fg-1)] hover:bg-[var(--c-card-alt)] transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {name}
                {id === profile.store_id && <Check size={14} className="text-brand-500" />}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <SyncIndicator storeId={profile.store_id} />
        {/* Role badge */}
        <span className="text-[11px] px-2 py-0.5 rounded-md font-medium mr-1
          bg-[var(--c-card-alt)] text-[var(--fg-2)] border border-[var(--c-border)]">
          {ROLE_LABELS[profile.role] ?? profile.role}
        </span>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg
            text-[var(--fg-2)] hover:bg-[var(--c-card-alt)] hover:text-[var(--fg-1)] transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-8 h-8 flex items-center justify-center rounded-lg
            text-[var(--fg-3)] hover:bg-[var(--c-card-alt)] hover:text-red-500 transition-colors"
          title="Sign out"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  )
}
