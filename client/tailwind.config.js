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
        tracker: {
          bg: '#0B0E14',
          surface: '#151922',
          card: '#1C2230',
          border: '#2A3245',
          text: '#F3F4F6',
          muted: '#9CA3AF',
          accent: '#E53E3E', // warm cinematic accent
          accentHover: '#C53030',
          amber: '#F59E0B',
          emerald: '#10B981',
          indigo: '#6366F1'
        }
      }
    },
  },
  plugins: [],
}
