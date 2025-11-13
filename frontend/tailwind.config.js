import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#050816',
        surface: {
          DEFAULT: '#0f172a',
          muted: '#16213a',
          highlight: '#1f2a44',
        },
        primary: {
          DEFAULT: '#38bdf8',
          foreground: '#020617',
        },
        accent: {
          DEFAULT: '#f472b6',
          foreground: '#0b1120',
        },
        success: {
          DEFAULT: '#34d399',
          foreground: '#03130c',
        },
        warning: {
          DEFAULT: '#fb923c',
          foreground: '#190b01',
        },
        neutral: {
          50: '#f8fafc',
          100: '#eef2ff',
          200: '#cbd5f5',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#312e81',
          900: '#1e1b4b',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', ...defaultTheme.fontFamily.sans],
        display: ['"Orbitron"', ...defaultTheme.fontFamily.sans],
        mono: ['"Space Mono"', ...defaultTheme.fontFamily.mono],
      },
      backgroundImage: {
        'grid-glow':
          'radial-gradient(circle at top, rgba(56, 189, 248, 0.25), transparent 60%), radial-gradient(circle at bottom, rgba(244, 114, 182, 0.2), transparent 55%)',
      },
      boxShadow: {
        neon: '0 0 25px rgba(56, 189, 248, 0.45)',
        surface: '0 12px 40px rgba(15, 23, 42, 0.65)',
      },
      borderRadius: {
        xl: '1.25rem',
      },
      spacing: {
        18: '4.5rem',
      },
      transitionTimingFunction: {
        'gentle-in-out': 'cubic-bezier(0.45, 0, 0.55, 1)',
      },
    },
  },
  plugins: [],
}
