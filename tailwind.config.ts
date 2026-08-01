import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f4f6f8',
          100: '#e4e9ee',
          200: '#c8d2dc',
          300: '#a3b3c2',
          400: '#748da3',
          500: '#587189',
          600: '#455a70',
          700: '#39495c',
          800: '#313f4e',
          900: '#2c3743',
          950: '#1a222b',
        },
        brand: {
          50: '#eef8ff',
          100: '#d9efff',
          200: '#bce4ff',
          300: '#8ed4ff',
          400: '#59bbff',
          500: '#339bff',
          600: '#1a7af5',
          700: '#1363e1',
          800: '#1650b6',
          900: '#18458f',
          950: '#132b57',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-geist-sans)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
