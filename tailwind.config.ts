import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        charm: {
          bg: '#0b0f17',
          surface: '#121826',
          surfaceAlt: '#1a2333',
          border: '#243047',
          primary: '#5eb1ff',
          primaryDark: '#2f7fd1',
          accent: '#f5a623',
          major: '#c084fc',
          minor: '#34d399',
          danger: '#f87171',
          warning: '#fbbf24',
          muted: '#7c8aa5',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(94,177,255,0.15), 0 8px 24px -8px rgba(94,177,255,0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
