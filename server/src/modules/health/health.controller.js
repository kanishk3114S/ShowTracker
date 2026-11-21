import { checkDatabaseConnection } from '../../config/database.js';

/**
 * Controller for GET /api/health
 * Checks both Express server runtime status and PostgreSQL database connection.
 */
export const getHealth = async (req, res, next) => {
  try {
    const dbStatus = await checkDatabaseConnection();

    const isHealthy = dbStatus.ok;
    const overallStatus = isHealthy ? 'healthy' : 'degraded';
    const isProduction = process.env.NODE_ENV === 'production';

    const healthReport = {
      success: true,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      services: {
        server: {
          status: 'healthy',
          ...(!isProduction ? { nodeVersion: process.version } : {})
        },
        database: {
          status: dbStatus.ok ? 'connected' : 'disconnected',
          engine: 'PostgreSQL',
          ...(dbStatus.ok
            ? {
                serverTime: dbStatus.time,
                ...(!isProduction
                  ? {
                      database: dbStatus.database,
                      connectedAs: dbStatus.user,
                      schema: dbStatus.schema
                    }
                  : {})
              }
            : {
                ...(!isProduction
                  ? {
                      error: dbStatus.error,
                      hint: 'Check DATABASE_URL in server/.env or ensure PostgreSQL is running.'
                    }
                  : { message: 'Database connection is temporarily unavailable.' })
              })
        }
      }
    };

    // Return 200 even if database is degraded so client UI can display diagnostics
    res.status(200).json(healthReport);
  } catch (error) {
    next(error);
  }
};
