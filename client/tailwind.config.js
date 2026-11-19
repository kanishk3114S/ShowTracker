/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Elegant Mincho serif for the ghost kanji watermarks
        mincho: ['"Shippori Mincho"', '"Yu Mincho"', '"Hiragino Mincho ProN"', '"Noto Serif JP"', 'serif']
      },
      colors: {
        // Neutral near-black surfaces (no color cast), stepped by elevation
        ink: {
          base: '#09090B', // page
          surface: '#111113', // panels, cards
          raised: '#18181B', // inputs, menus, hover surfaces
          line: '#1F1F23', // hairlines
          edge: '#2A2A30' // component borders
        },
        fg: {
          DEFAULT: '#FAFAFA',
          muted: '#A1A1AA',
          subtle: '#71717A'
        },
        // The one accent: warm gold. Used for the primary action, active states, ratings and progress.
        accent: { DEFAULT: '#F2B33D', hover: '#F7C566', deep: '#D99A22', soft: 'rgba(242,179,61,0.12)' },
        // Legacy alias so older class names keep working with the same gold
        copper: { DEFAULT: '#F2B33D', hover: '#F7C566', deep: '#D99A22' },
        amber: { DEFAULT: '#F2B33D' },
        vermilion: { DEFAULT: '#EF4444' },

        // Legacy tokens kept so untouched screens (e.g. Health) keep working
        tracker: {
          bg: '#0B0E14',
          surface: '#151922',
          card: '#1C2230',
          border: '#2A3245',
          text: '#F3F4F6',
          muted: '#9CA3AF',
          accent: '#E53E3E',
          accentHover: '#C53030',
          amber: '#F59E0B',
          emerald: '#10B981',
          indigo: '#6366F1'
        }
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 28px -14px rgba(0,0,0,0.75)',
        lift: '0 22px 44px -18px rgba(0,0,0,0.85)',
        glass: '0 8px 32px 0 rgba(0,0,0,0.55), inset 0 1px 0 0 rgba(255,255,255,0.07)'
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' }
        },
        'ping-soft': {
          '0%': { transform: 'scale(1)', opacity: '0.7' },
          '80%, 100%': { transform: 'scale(2.6)', opacity: '0' }
        },
        sheen: {
          '0%': { transform: 'translateX(-120%) skewX(-18deg)' },
          '100%': { transform: 'translateX(320%) skewX(-18deg)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        twinkle: {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)', filter: 'brightness(1)' },
          '50%': { transform: 'scale(1.18) rotate(12deg)', filter: 'brightness(1.4)' }
        },
        'check-pop': {
          '0%': { transform: 'scale(0.4)', opacity: '0' },
          '60%': { transform: 'scale(1.25)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        }
      },
      animation: {
        shimmer: 'shimmer 2.2s linear infinite',
        'ping-soft': 'ping-soft 1.8s cubic-bezier(0,0,0.2,1) infinite',
        sheen: 'sheen 0.9s ease-in-out',
        float: 'float 7s ease-in-out infinite',
        twinkle: 'twinkle 3.2s ease-in-out infinite',
        'check-pop': 'check-pop 0.32s cubic-bezier(0.34,1.56,0.64,1) both'
      }
    }
  },
  plugins: []
};
