/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#08080f',
          surface: '#0e0e1c',
          card: '#121220',
          border: '#1a1a32',
          muted: '#1e1e38',
          text: '#e2e8f0',
          dim: '#64748b',
          blue: '#00d4ff',
          green: '#00ff88',
          amber: '#ffd60a',
          red: '#ff4757',
          orange: '#ff6b35',
          purple: '#c77dff',
          pink: '#ff6eb4',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(0, 212, 255, 0.25)',
        'glow-green': '0 0 20px rgba(0, 255, 136, 0.25)',
        'glow-red': '0 0 20px rgba(255, 71, 87, 0.25)',
        'glow-blue-sm': '0 0 10px rgba(0, 212, 255, 0.2)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.5)',
      },
      backdropBlur: {
        xs: '4px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'blob': 'blob 8s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 8px rgba(0, 212, 255, 0.3)' },
          '100%': { boxShadow: '0 0 24px rgba(0, 212, 255, 0.7)' },
        },
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(30px, -20px) scale(1.05)' },
          '66%': { transform: 'translate(-20px, 15px) scale(0.96)' },
        },
      }
    },
  },
  plugins: [],
}
