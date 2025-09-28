/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'circle': {
          'dark': '#0a0a0a',
          'gray': '#1a1a1a',
          'blue': '#1e3a8a',
          'green': '#059669',
          'red': '#dc2626',
          'purple': '#7c3aed',
        }
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'vault-open': 'vault-open 2s ease-in-out',
        'destruction': 'destruction 0.5s ease-in-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'vault-open': {
          '0%': { transform: 'scale(0.8) rotateY(-90deg)', opacity: '0' },
          '50%': { transform: 'scale(1.1) rotateY(0deg)', opacity: '0.8' },
          '100%': { transform: 'scale(1) rotateY(0deg)', opacity: '1' },
        },
        'destruction': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.5', filter: 'blur(2px)' },
          '100%': { transform: 'scale(0)', opacity: '0', filter: 'blur(10px)' },
        }
      }
    },
  },
  plugins: [],
}