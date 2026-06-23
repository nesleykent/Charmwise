import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        charm: {
          bg: '#080a0d',
          surface: '#111419',
          surfaceAlt: '#181c23',
          border: '#2b313b',
          borderStrong: '#3a4350',
          primary: '#0a84ff',
          primaryDark: '#006edb',
          accent: '#ffd60a',
          major: '#bf5af2',
          minor: '#30d158',
          danger: '#ff453a',
          warning: '#ffd60a',
          muted: '#a8b0bd',
          subtle: '#737c89',
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
        display: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(10,132,255,0.35), 0 12px 32px -18px rgba(10,132,255,0.9)',
        card: '0 22px 60px -44px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.04)',
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
