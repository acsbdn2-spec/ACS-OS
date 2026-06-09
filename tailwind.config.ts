import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Surface colours are driven by CSS variables so they flip with theme.
        // bg-surface-900 = page background, bg-surface-800 = card, etc.
        surface: {
          900: 'var(--c-bg)',
          800: 'var(--c-card)',
          700: 'var(--c-card-alt)',
          600: 'var(--c-border)',
          500: 'var(--c-border-2)',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      screens:    { xs: '375px' },
      spacing:    { safe: 'env(safe-area-inset-bottom)' },
      boxShadow: {
        card: 'var(--shadow-sm)',
        md:   'var(--shadow-md)',
      },
    },
  },
  plugins: [],
}

export default config
