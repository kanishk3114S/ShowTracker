import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import profileRoutes from './modules/profiles/profiles.routes.js';
import mediaRoutes from './modules/media/media.routes.js';
import libraryRoutes from './modules/library/library.routes.js';
import { getPublicProfile } from './modules/profiles/profiles.controller.js';
import { optionalAuth } from './middleware/requireAuth.js';
import { mediaDiscoveryLimiter, usernameCheckLimiter, authLimiter, apiLimiter } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');
/** True when the built React app is next to the API and is served by this same server (unified deployment). */
export const servesClient = fs.existsSync(path.join(clientDistPath, 'index.html'));

const app = express();

// Behind a reverse proxy (Render, Railway, ...) the real client IP is in X-Forwarded-For.
// Needed so rate limiting counts visitors, not the proxy. TRUST_PROXY = number of proxy hops (default 1 in production).
const trustProxy = process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? '1' : '');
if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true');
app.disable('x-powered-by');

// Security headers (Helmet). Two policies, chosen by path:
//   /api/*  JSON only: nothing may be loaded or embedded (default-src 'none')
//   pages   the React app served from this same server (self-hosted scripts, the few image hosts it uses)
const SHARED_HEADERS = {
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: true }
};
const apiHeaders = helmet({
  ...SHARED_HEADERS,
  contentSecurityPolicy: {
    useDefaults: false,
    directives: { defaultSrc: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"], frameAncestors: ["'none'"] }
  }
});
const pageHeaders = helmet({
  ...SHARED_HEADERS,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
        'https://image.tmdb.org',
        'https://s4.anilist.co',
        'https://static.tvmaze.com',
        'https://artworks.thetvdb.com',
        'https://*.supabase.co',
        'https://lh3.googleusercontent.com'
      ],
      connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
});
app.use((req, res, next) => (req.path.startsWith('/api') ? apiHeaders : pageHeaders)(req, res, next));

// Cross-Origin Resource Sharing. CLIENT_URL may list several origins separated by commas.
// With the unified deployment the app and the API share one origin and need no CORS at all; CLIENT_URL is only
// for a frontend hosted elsewhere. In production nothing is allowed unless it is listed (never localhost by default).
const clientOrigins = (process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173'))
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);
const devOrigins = process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(
  cors({
    origin: [...new Set([...clientOrigins, ...devOrigins])],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Request parsing
// Every payload this API accepts is tiny (notes are capped at 2000 characters): 100 kB is plenty.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Abuse protection for routes that spend provider quota or reveal account names (429 + Retry-After)
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/media/search', mediaDiscoveryLimiter);
app.use('/api/media/trending', mediaDiscoveryLimiter);
app.use('/api/media/franchise', mediaDiscoveryLimiter);
app.use('/api/profiles/username-availability', usernameCheckLimiter);

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/library', libraryRoutes);

// Direct /api/users/:username route for public profile lookup
app.get('/api/users/:username', optionalAuth, getPublicProfile);

// Any unknown /api/* route returns structured 404 JSON
app.use('/api', notFoundHandler);

// Unified Frontend Hosting: serve client/dist if built
if (fs.existsSync(clientDistPath)) {
  // Vite static assets with 1-year immutable caching
  app.use(
    '/assets',
    express.static(path.join(clientDistPath, 'assets'), {
      maxAge: '1y',
      immutable: true
    })
  );

  // Other public static files (favicon, manifest, etc.)
  app.use(express.static(clientDistPath, { index: false, maxAge: '1h' }));

  // Root and SPA routes serve index.html
  app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });

  app.get('*', (req, res, next) => {
    // /assets/missing.js or /favicon.ico that does not exist must be a real 404, not the app's HTML page
    if (path.extname(req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });

  app.use(notFoundHandler);
} else {
  // Standalone API notice (fallback when client is not built)
  app.get('/', (req, res) => {
    res.json({
      message: 'ShowTracker API is active. Health check available at /api/health',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth/me',
        profile: '/api/profiles/me',
        availability: '/api/profiles/username-availability',
        publicUser: '/api/users/:username'
      }
    });
  });

  app.use(notFoundHandler);
}

// Centralized Error Handling
app.use(errorHandler);

export default app;
