'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Package, Barcode, Users, Wrench,
  FileText, BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/database'

const NAV: Record<Role, { href: string; icon: React.ElementType; label: string }[]> = {
  owner: [
    { href: '/dashboard', icon: Home,      label: 'Home'    },
    { href: '/catalog',   icon: Package,   label: 'Catalog' },
    { href: '/customers', icon: Users,     label: 'Clients' },
    { href: '/service',   icon: Wrench,    label: 'Service' },
    { href: '/reports',   icon: BarChart2, label: 'Reports' },
  ],
  staff: [
    { href: '/catalog',   icon: Package,  label: 'Catalog' },
    { href: '/serials',   icon: Barcode,  label: 'Serials' },
    { href: '/quotes',    icon: FileText, label: 'Quotes'  },
    { href: '/customers', icon: Users,    label: 'Clients' },
    { href: '/service',   icon: Wrench,   label: 'Service' },
  ],
  technician: [
    { href: '/service', icon: Wrench,  label: 'My Jobs' },
    { href: '/catalog', icon: Package, label: 'Catalog' },
    { href: '/serials', icon: Barcode, label: 'Serials' },
  ],
  viewer: [
    { href: '/dashboard', icon: Home,      label: 'Home'    },
    { href: '/catalog',   icon: Package,   label: 'Catalog' },
    { href: '/reports',   icon: BarChart2, label: 'Reports' },
  ],
}

export default function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname()
  const items    = NAV[role] ?? NAV.staff

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40
        bg-[var(--c-card)] border-t border-[var(--c-border)]
        flex shadow-[0_-1px_0_var(--c-border)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href} href={href}
            className="flex-1 flex flex-col items-center justify-center pt-2 pb-1.5 gap-0.5 relative"
          >
            {/* Active indicator — thin line at top */}
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5
                rounded-full bg-brand-500" />
            )}
            <Icon
              size={21}
              strokeWidth={active ? 2.2 : 1.7}
              className={cn(
                'transition-colors',
                active ? 'text-brand-500' : 'text-[var(--fg-3)]'
              )}
            />
            <span className={cn(
              'text-[10px] tracking-wide transition-colors',
              active
                ? 'text-brand-500 font-semibold'
                : 'text-[var(--fg-3)] font-normal'
            )}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
