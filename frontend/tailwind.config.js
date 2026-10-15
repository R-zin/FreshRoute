/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: '#090a0f',
          50: '#1e2230',
          100: '#181b26',
          200: '#141720',
          300: '#10131b',
          400: '#0d0f15',
          500: '#090a0f',
        },
        surface: {
          DEFAULT: '#0f1219',
          dark: '#08090d',
          card: '#121622',
          light: '#181d2a',
          inset: '#0b0e14',
          container: '#151926',
          border: 'rgba(255, 255, 255, 0.07)',
        },
        brand: {
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
          sky: '#38bdf8',
        },
        slate: {
          850: '#141822',
          925: '#0b0e14',
          950: '#07090e',
        },
      },
      boxShadow: {
        'subtle': '0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.24)',
        'elevated': '0 4px 20px -2px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        'elevated-hover': '0 8px 28px -4px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.12)',
        'glow-emerald': '0 0 16px rgba(16, 185, 129, 0.25)',
        'glow-amber': '0 0 16px rgba(245, 158, 11, 0.25)',
        'glow-rose': '0 0 16px rgba(244, 63, 94, 0.25)',
        'glow-white': '0 0 16px rgba(255, 255, 255, 0.15)',
        'tactile-extruded': '0 2px 8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        'tactile-extruded-hover': '0 4px 12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'tactile-debossed': 'inset 0 1px 3px rgba(0, 0, 0, 0.7)',
        'tactile-pressed': 'inset 0 2px 4px rgba(0, 0, 0, 0.8)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        space: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
