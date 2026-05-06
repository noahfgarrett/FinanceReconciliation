/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── LotusWorks brand palettes (authoritative from Colour Guide PDF) ──
        // Lotus Orange — DEFAULT 500 = #F47B20
        'lw-orange': {
          DEFAULT: '#F47B20',
          50:  '#FFF6EE',
          100: '#FFE7CF',
          200: '#FFCB97',
          300: '#FFAD64',
          400: '#FB8E3F',
          500: '#F47B20',
          600: '#D9620E',
          700: '#A8480A',
          800: '#7C3408',
          900: '#552306',
          950: '#2D1303',
        },
        // Lotus Blue — DEFAULT 700 = #0057A4
        'lw-blue': {
          DEFAULT: '#0057A4',
          50:  '#EBF3FB',
          100: '#D2E4F6',
          200: '#A4C8EC',
          300: '#6FA6DD',
          400: '#3D85CC',
          500: '#1A6CB8',
          600: '#0961AC',
          700: '#0057A4',
          800: '#01457F',
          900: '#06335B',
          950: '#031D38',
        },
        // Brand alias tokens — read from CSS variables defined in index.css.
        // Components can use `bg-brand-orange` / `text-brand-blue` style classes.
        'brand-orange': 'var(--brand-orange)',
        'brand-blue': 'var(--brand-blue)',
        // Semantic token-driven colors
        surface: {
          base: 'var(--surface-base)',
          elevated: 'var(--surface-elevated)',
          overlay: 'var(--surface-overlay)',
          interactive: 'var(--surface-interactive)',
          'interactive-hover': 'var(--surface-interactive-hover)',
        },
        ink: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
        },
        line: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          emphasis: 'var(--border-emphasis)',
        },
        // Keep slate.950 override for dark default surface anchor
        slate: { 950: '#020617' },
      },
      fontFamily: {
        // Display: Space Grotesk — geometric, premium feel, distinctive lowercase a
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        // Body: Plus Jakarta Sans — modern, friendly, excellent at small sizes
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        // Mono: JetBrains Mono — for code, kbd, occasional numeric emphasis
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Type scale anchored on 16px (1rem) at "base", perfect-fourth (1.333) for display.
        // Letter-spacing tightens at larger sizes for premium feel.
        xs:   ['0.75rem',  { lineHeight: '1.1rem',  letterSpacing: '0.005em' }],
        sm:   ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0' }],
        base: ['1rem',     { lineHeight: '1.5rem',  letterSpacing: '0' }],
        lg:   ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.005em' }],
        xl:   ['1.25rem',  { lineHeight: '1.75rem',  letterSpacing: '-0.01em'  }],
        '2xl':['1.5rem',   { lineHeight: '2rem',     letterSpacing: '-0.015em' }],
        '3xl':['1.875rem', { lineHeight: '2.25rem',  letterSpacing: '-0.02em'  }],
        '4xl':['2.25rem',  { lineHeight: '2.5rem',   letterSpacing: '-0.025em' }],
        '5xl':['3rem',     { lineHeight: '3.25rem',  letterSpacing: '-0.03em'  }],
      },
      boxShadow: {
        // Elevation scale — uses CSS variables so light mode can override.
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        // Brand glows for primary buttons + active focus rings
        'glow-orange': '0 6px 24px -4px rgba(244, 123, 32, 0.45), 0 2px 8px -2px rgba(244, 123, 32, 0.25)',
        'glow-blue':   '0 6px 24px -4px rgba(0, 87, 164, 0.45), 0 2px 8px -2px rgba(0, 87, 164, 0.25)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-back': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        normal: '200ms',
        slow: '320ms',
      },
      animation: {
        'fade-in': 'fadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up': 'slideUp 250ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-down': 'slideDown 250ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in': 'slideIn 300ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slideInRight 300ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scaleIn 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(244, 123, 32, 0.4)' },
          '50%':      { boxShadow: '0 0 0 6px rgba(244, 123, 32, 0)' },
        },
      },
    },
  },
  plugins: [],
}
