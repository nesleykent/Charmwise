import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        charm: {
          bg: '#0a0d12',
          surface: '#13171f',
          surfaceAlt: '#1a1f29',
          border: '#252b37',
          borderStrong: '#34404f',
          primary: '#5eb1ff',
          primaryDark: '#2f7fd1',
          accent: '#f5a623',
          major: '#c084fc',
          minor: '#34d399',
          danger: '#f87171',
          warning: '#fbbf24',
          // Two tiers of secondary text, matching HIG's primary/secondary/tertiary
          // label hierarchy - `muted` for body copy, `subtle` for the least
          // important text (helper notes, decorative metadata).
          muted: '#9aa6bc',
          subtle: '#6b7587',
          // Atmosphere blob palette - muted, desaturated takes on
          // sunrise/twilight, reusing the existing brand hues (accent/major/
          // primary) plus one new dusty rose, rather than introducing an
          // unrelated saturated palette.
          rose: '#d98a96',
        },
      },
      fontFamily: {
        // The system font stack IS the HIG-recommended choice for the web - it
        // renders as San Francisco on Apple platforms with zero webfont
        // loading cost, and a native-feeling equivalent everywhere else.
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'system-ui',
          'sans-serif',
        ],
        // Editorial serif for large headlines only - body copy stays on the
        // system sans above. Loaded via next/font in layout.tsx as --font-display.
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(94,177,255,0.15), 0 8px 24px -8px rgba(94,177,255,0.25)',
        card: '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
