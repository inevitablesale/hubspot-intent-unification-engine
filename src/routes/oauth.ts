import { Router, Request, Response } from 'express';
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  isAuthenticated,
  revokeTokens,
} from '../services/hubspotService';

const router = Router();

/**
 * GET /oauth/authorize
 * Redirect to HubSpot OAuth authorization page
 */
router.get('/authorize', (_req: Request, res: Response) => {
  try {
    const authUrl = getAuthorizationUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error generating authorization URL:', error);
    res.status(500).json({
      error: 'Failed to generate authorization URL',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /oauth/callback
 * Handle OAuth callback from HubSpot
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).json({
      error: error as string,
      description: error_description as string,
    });
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      error: 'Missing authorization code',
    });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    res.json({
      success: true,
      portalId: tokens.portalId,
      message: 'Successfully authenticated with HubSpot',
    });
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).json({
      error: 'Failed to exchange authorization code',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /oauth/status/:portalId
 * Check authentication status for a portal
 */
router.get('/status/:portalId', (req: Request, res: Response) => {
  const { portalId } = req.params;
  const authenticated = isAuthenticated(portalId);
  
  res.json({
    portalId,
    authenticated,
  });
});

/**
 * DELETE /oauth/revoke/:portalId
 * Revoke tokens for a portal
 */
router.delete('/revoke/:portalId', async (req: Request, res: Response) => {
  const { portalId } = req.params;
  
  try {
    await revokeTokens(portalId);
    res.json({
      success: true,
      message: `Tokens revoked for portal ${portalId}`,
    });
  } catch (error) {
    console.error('Error revoking tokens:', error);
    res.status(500).json({
      error: 'Failed to revoke tokens',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
