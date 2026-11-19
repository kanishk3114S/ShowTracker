/**
 * Custom application error class for operational errors.
 */
export class AppError extends Error {
  /**
   * @param {string} message - Human-readable error description
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {string} [code] - Machine-readable error code (e.g., 'RESOURCE_NOT_FOUND')
   * @param {any} [details] - Optional validation or context details
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 Handler for undefined routes.
 */
export const notFoundHandler = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
};

/** A stable, machine-readable code: ours when we set one, a clear one for body-parser problems, else generic. */
function errorCode(err) {
  if (typeof err.code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(err.code)) return err.code;
  if (err.type === 'entity.too.large') return 'PAYLOAD_TOO_LARGE';
  if (err.type === 'entity.parse.failed') return 'INVALID_JSON';
  return 'INTERNAL_SERVER_ERROR';
}

/**
 * Centralized express error handler middleware.
 * Guarantees a consistent JSON response and avoids leaking stack traces in production.
 */
export const errorHandler = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  // Only errors we raised on purpose (AppError / ProviderError) or http-errors marked `expose` (bad JSON,
  // payload too large) may show their message. Anything else (database driver errors, bugs) is masked in
  // production: no SQL, table names, file paths or stack traces ever reach a client.
  const operational = err.isOperational === true || err.expose === true;
  const masked = !isDevelopment && !operational;
  const statusCode = masked ? 500 : err.statusCode || err.status || 500;

  // Log error with appropriate severity
  if (statusCode >= 500) {
    console.error(`[Server Error] [${req.method} ${req.originalUrl}]:`, err);
  } else if (isDevelopment) {
    console.warn(`[Client Error ${statusCode}] [${req.method} ${req.originalUrl}]:`, err.message);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message: masked ? 'An unexpected internal error occurred.' : err.message || 'An unexpected internal error occurred.',
      code: masked ? 'INTERNAL_SERVER_ERROR' : errorCode(err),
      ...(!masked && err.details ? { details: err.details } : {}),
      ...(isDevelopment && err.stack ? { stack: err.stack } : {})
    }
  });
};

export default {
  AppError,
  notFoundHandler,
  errorHandler
};
