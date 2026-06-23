import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        charm: {
          bg: '#050615',
          surface: '#121528',
          surfaceAlt: '#1a1d36',
          border: 'rgba(255,255,255,0.16)',
          borderStrong: 'rgba(255,255,255,0.32)',
          primary: '#8ab8ff',
          primaryDark: '#4b7dff',
          accent: '#fee140',
          coral: '#fd5949',
          rose: '#fa709a',
          magenta: '#d6249f',
          violet: '#764ba2',
          twilight: '#285aeb',
          major: '#c99cff',
          minor: '#77f2cb',
          danger: '#ff6b6b',
          warning: '#fee140',
          muted: '#d6d9ea',
          subtle: '#969cb9',
        },
      },
      fontFamily: {
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
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(254,225,64,0.24), 0 18px 50px -18px rgba(250,112,154,0.82), 0 18px 70px -36px rgba(40,90,235,0.9)',
        card: '0 28px 90px -54px rgba(0,0,0,0.98), inset 0 1px 0 rgba(255,255,255,0.16)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(3rem, -2rem, 0) scale(1.08)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-out',
        drift: 'drift 18s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
