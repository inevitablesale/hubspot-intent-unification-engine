import express, { Application, Request, Response, NextFunction } from 'express';
import { oauthRoutes, syncRoutes, scoringRoutes, crmCardRoutes } from './routes';

/**
 * Create and configure the Express application
 */
export function createApp(): Application {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // API Routes
  app.use('/oauth', oauthRoutes);
  app.use('/sync', syncRoutes);
  app.use('/scoring', scoringRoutes);
  app.use('/crm-cards', crmCardRoutes);

  // Root endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'HubSpot Intent Unification Engine',
      description: 'Unifies Apollo and ZoomInfo intent signals into HubSpot',
      endpoints: {
        health: '/health',
        oauth: {
          authorize: '/oauth/authorize',
          callback: '/oauth/callback',
          status: '/oauth/status/:portalId',
          revoke: '/oauth/revoke/:portalId',
        },
        sync: {
          apolloIntent: 'POST /sync/apollo/intent',
          zoomInfoIntent: 'POST /sync/zoominfo/intent',
          apolloEnrichment: 'POST /sync/apollo/enrichment',
          zoomInfoEnrichment: 'POST /sync/zoominfo/enrichment',
          mergedEnrichment: 'GET /sync/enrichment/merged/:entityType/:entityId',
          scores: 'GET /sync/scores',
          companyScore: 'GET /sync/scores/:companyId',
          spikes: 'GET /sync/spikes',
        },
        scoring: {
          icp: 'POST /scoring/icp',
          icpBatch: 'POST /scoring/icp/batch',
          persona: 'POST /scoring/persona',
          personaBatch: 'POST /scoring/persona/batch',
        },
        crmCards: {
          intentTrends: 'GET /crm-cards/intent-trends',
          icpMatch: 'GET /crm-cards/icp-match',
          persona: 'GET /crm-cards/persona',
        },
      },
    });
  });

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
    });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    });
  });

  return app;
}
