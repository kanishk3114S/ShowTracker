/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      colors: {
        // Cinematic Editorial Premium palette
        ink: {
          base: '#0B0E14', // page background
          surface: '#12161F', // cards, panels
          raised: '#181F2B', // elevated cards, inputs, menus
          line: '#1F2633', // hairline dividers
          edge: '#2A3245' // component borders
        },
        fg: {
          DEFAULT: '#F3F4F6', // warm off-white
          muted: '#9CA3AF',
          subtle: '#6B7280'
        },
        copper: { DEFAULT: '#E07A5F', hover: '#E98E75', deep: '#B85C43' },
        amber: { DEFAULT: '#F59E0B' },
        vermilion: { DEFAULT: '#E50914' },

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
        card: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
        lift: '0 18px 40px -16px rgba(0,0,0,0.75)'
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' }
        }
      },
      animation: {
        shimmer: 'shimmer 2.2s linear infinite'
      }
    }
  },
  plugins: []
};
