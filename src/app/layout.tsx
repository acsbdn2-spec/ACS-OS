import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'ACS·OS',
  description: 'Operations platform — Advanced Computer System, Burdwan',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'ACS·OS' },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#0e0f1a' },
    { media: '(prefers-color-scheme: light)', color: '#f1f2f7' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

// Runs before React hydrates — prevents flash of wrong theme
const themeScript = `
  try {
    var t = localStorage.getItem('acs-theme');
    var dark = t ? t === 'dark' : true; // default dark
    document.documentElement.classList.toggle('dark', dark);
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* Theme init — must be synchronous to avoid FOUC */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} font-sans`}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            className: '',
            style: {
              background: 'var(--c-card)',
              color:      'var(--fg-1)',
              border:     '1px solid var(--c-border-2)',
              borderRadius: '10px',
              fontSize:   '0.9rem',
              boxShadow:  'var(--shadow-md)',
              padding:    '10px 16px',
            },
          }}
        />
      </body>
    </html>
  )
}
