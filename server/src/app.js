import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import profileRoutes from './modules/profiles/profiles.routes.js';
import mediaRoutes from './modules/media/media.routes.js';
import libraryRoutes from './modules/library/library.routes.js';
import { getPublicProfile } from './modules/profiles/profiles.controller.js';
import { optionalAuth } from './middleware/requireAuth.js';
import { mediaDiscoveryLimiter, usernameCheckLimiter } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

// Behind a reverse proxy (Render, Railway, ...) the real client IP is in X-Forwarded-For.
// Needed so rate limiting counts visitors, not the proxy. TRUST_PROXY = number of proxy hops (default 1 in production).
const trustProxy = process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? '1' : '');
if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true');
app.disable('x-powered-by');

// Security headers with Helmet. This server only returns JSON, so its CSP forbids loading or
// embedding anything at all; the React app is a separate origin with its own hosting headers.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: { maxAge: 15552000, includeSubDomains: true }
  })
);

// Cross-Origin Resource Sharing. CLIENT_URL may list several origins separated by commas.
const clientOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);
app.use(
  cors({
    origin: [...new Set([...clientOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173'])],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Request parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Abuse protection for routes that spend provider quota or reveal account names (429 + Retry-After)
app.use('/api/media/search', mediaDiscoveryLimiter);
app.use('/api/media/trending', mediaDiscoveryLimiter);
app.use('/api/profiles/username-availability', usernameCheckLimiter);

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/library', libraryRoutes);

// Direct /api/users/:username route for public profile lookup
app.get('/api/users/:username', optionalAuth, getPublicProfile);

// Root route notice
app.get('/', (req, res) => {
  res.json({
    message: 'ShowTracker API is active. Health check available at /api/health',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/me',
      profile: '/api/profiles/me',
      availability: '/api/profiles/username-availability',
      publicUser: '/api/users/:username'
    }
  });
});

// Centralized 404 & Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
