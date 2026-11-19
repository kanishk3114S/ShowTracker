import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Stable vendor chunks: libraries change rarely, so browsers keep them cached across deploys
// of the app code, and no single chunk grows past the 500 kB warning limit.
const VENDOR_CHUNKS = [
  { name: 'vendor-react', test: /node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler)[\/]/ },
  { name: 'vendor-motion', test: /node_modules[\/](motion|motion-dom|motion-utils|framer-motion)[\/]/ },
  { name: 'vendor-icons', test: /node_modules[\/]lucide-react[\/]/ },
  { name: 'vendor-supabase', test: /node_modules[\/]@supabase[\/]/ },
]

// Absolute site URL for OpenGraph/Twitter tags (crawlers need absolute image URLs).
// Set VITE_SITE_URL=https://your-app.vercel.app at build time; empty falls back to relative paths.
const siteUrl = (process.env.VITE_SITE_URL || '').replace(/\/$/, '')
const siteUrlPlugin = {
  name: 'showtracker-site-url',
  transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), siteUrlPlugin],
  build: {
    chunkSizeWarningLimit: 500,
    rolldownOptions: {
      output: { codeSplitting: { groups: VENDOR_CHUNKS } },
    },
  },
})
