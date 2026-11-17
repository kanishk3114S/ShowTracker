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

/**
 * Centralized express error handler middleware.
 * Guarantees a consistent JSON response and avoids leaking stack traces in production.
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Log error with appropriate severity
  if (statusCode >= 500) {
    console.error(`[Server Error] [${req.method} ${req.originalUrl}]:`, err);
  } else if (isDevelopment) {
    console.warn(`[Client Error ${statusCode}] [${req.method} ${req.originalUrl}]:`, err.message);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'An unexpected internal error occurred.',
      code: err.code || 'INTERNAL_SERVER_ERROR',
      ...(err.details ? { details: err.details } : {}),
      ...(isDevelopment && err.stack ? { stack: err.stack } : {})
    }
  });
};

export default {
  AppError,
  notFoundHandler,
  errorHandler
};
