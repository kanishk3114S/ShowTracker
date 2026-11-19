import './lib/escapeHatch' // must stay first: wipes storage for ?clear-cache=1 before anything reads it
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { MotionProvider } from './components/ui/motion'
import ErrorBoundary from './components/common/ErrorBoundary'
import ConfigError from './components/common/ConfigError'
import { findConfigProblems } from './lib/config'

// A production build without its VITE_* settings would show an empty app: say what is missing instead.
const problems = findConfigProblems()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <MotionProvider>{problems.length ? <ConfigError problems={problems} /> : <App />}</MotionProvider>
    </ErrorBoundary>
  </StrictMode>,
)
