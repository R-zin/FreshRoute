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
        surface: {
          DEFAULT: '#111418',
          dark: '#0b0e12',
          card: '#15191f',
          light: '#181d22',
          inset: '#0e1115',
          container: '#1d2024',
        },
        slate: {
          850: '#14181f',
          925: '#0b0d11',
          950: '#07090c',
        },
      },
      boxShadow: {
        'tactile-extruded': '-3px -3px 7px rgba(255, 255, 255, 0.05), 4px 4px 10px rgba(0, 0, 0, 0.85)',
        'tactile-extruded-hover': '-4px -4px 9px rgba(255, 255, 255, 0.08), 5px 5px 14px rgba(0, 0, 0, 0.9)',
        'tactile-debossed': 'inset 3px 3px 7px rgba(0, 0, 0, 0.9), inset -2px -2px 6px rgba(255, 255, 255, 0.03)',
        'tactile-pressed': 'inset 2px 2px 5px rgba(0, 0, 0, 0.95), inset -2px -2px 5px rgba(255, 255, 255, 0.04)',
        'glow-white': '0 0 16px rgba(255, 255, 255, 0.25)',
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
