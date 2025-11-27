import { Client } from '@hubspot/api-client';
import { OAuthTokens, AwarenessSpike, UnifiedIntentScore } from '../models/types';

/**
 * In-memory token store (in production, use a secure database)
 */
const tokenStore: Map<string, OAuthTokens> = new Map();

/**
 * Default HubSpot OAuth scopes required for the app
 */
const DEFAULT_HUBSPOT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.companies.read',
  'crm.objects.companies.write',
  'timeline',
].join(' ');

/**
 * Get HubSpot OAuth configuration
 */
export function getOAuthConfig() {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI;
  const scopes = process.env.HUBSPOT_SCOPES || DEFAULT_HUBSPOT_SCOPES;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing HubSpot OAuth configuration. Check environment variables.');
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes: scopes.split(' '),
  };
}

/**
 * Generate OAuth authorization URL
 */
export function getAuthorizationUrl(): string {
  const config = getOAuthConfig();
  const scopeString = config.scopes.join('%20');
  return `https://app.hubspot.com/oauth/authorize?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&scope=${scopeString}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  const config = getOAuthConfig();
  const client = new Client();

  const tokenResponse = await client.oauth.tokensApi.create(
    'authorization_code',
    code,
    config.redirectUri,
    config.clientId,
    config.clientSecret
  );

  // Get portal ID from access token info
  client.setAccessToken(tokenResponse.accessToken);
  const accessTokenInfo = await client.oauth.accessTokensApi.get(tokenResponse.accessToken);

  const tokens: OAuthTokens = {
    portalId: accessTokenInfo.hubId?.toString() || 'unknown',
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken,
    expiresAt: Date.now() + (tokenResponse.expiresIn * 1000),
  };

  tokenStore.set(tokens.portalId, tokens);
  return tokens;
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(portalId: string): Promise<OAuthTokens> {
  const existingTokens = tokenStore.get(portalId);
  if (!existingTokens) {
    throw new Error(`No tokens found for portal ${portalId}`);
  }

  const config = getOAuthConfig();
  const client = new Client();

  const tokenResponse = await client.oauth.tokensApi.create(
    'refresh_token',
    undefined,
    config.redirectUri,
    config.clientId,
    config.clientSecret,
    existingTokens.refreshToken
  );

  const tokens: OAuthTokens = {
    portalId,
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken,
    expiresAt: Date.now() + (tokenResponse.expiresIn * 1000),
  };

  tokenStore.set(portalId, tokens);
  return tokens;
}

/**
 * Get a valid access token for a portal (refresh if needed)
 */
export async function getValidAccessToken(portalId: string): Promise<string> {
  const tokens = tokenStore.get(portalId);
  if (!tokens) {
    throw new Error(`No tokens found for portal ${portalId}`);
  }

  // Refresh if token expires in less than 5 minutes
  if (tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
    const newTokens = await refreshAccessToken(portalId);
    return newTokens.accessToken;
  }

  return tokens.accessToken;
}

/**
 * Get HubSpot client for a portal
 */
export async function getHubSpotClient(portalId: string): Promise<Client> {
  const accessToken = await getValidAccessToken(portalId);
  const client = new Client({ accessToken });
  return client;
}

/**
 * Check if a portal is authenticated
 */
export function isAuthenticated(portalId: string): boolean {
  return tokenStore.has(portalId);
}

/**
 * Revoke tokens for a portal
 */
export async function revokeTokens(portalId: string): Promise<void> {
  const tokens = tokenStore.get(portalId);
  if (tokens) {
    const client = new Client();
    
    try {
      await client.oauth.refreshTokensApi.archive(tokens.refreshToken);
    } catch (error) {
      console.error('Error revoking refresh token:', error);
    }
    
    tokenStore.delete(portalId);
  }
}

/**
 * Create a timeline event for an awareness spike
 */
export async function createAwarenessSpikeEvent(
  portalId: string,
  spike: AwarenessSpike,
  timelineEventTemplateId: string
): Promise<void> {
  if (!spike.hubspotCompanyId) {
    console.warn(`Cannot create timeline event: No HubSpot company ID for ${spike.companyName}`);
    return;
  }

  const client = await getHubSpotClient(portalId);

  await client.crm.timeline.eventsApi.create({
    eventTemplateId: timelineEventTemplateId,
    objectId: spike.hubspotCompanyId,
    tokens: {
      companyName: spike.companyName,
      previousScore: spike.previousScore.toString(),
      currentScore: spike.currentScore.toString(),
      percentageIncrease: spike.percentageIncrease.toString(),
      topics: spike.triggeringTopics.join(', '),
    },
    extraData: {
      previousScore: spike.previousScore,
      currentScore: spike.currentScore,
      percentageIncrease: spike.percentageIncrease,
      topics: spike.triggeringTopics,
    },
  });
}

/**
 * Update company properties with intent score
 */
export async function updateCompanyIntentScore(
  portalId: string,
  score: UnifiedIntentScore
): Promise<void> {
  if (!score.hubspotCompanyId) {
    console.warn(`Cannot update company: No HubSpot company ID for ${score.companyName}`);
    return;
  }

  const client = await getHubSpotClient(portalId);

  await client.crm.companies.basicApi.update(score.hubspotCompanyId, {
    properties: {
      intent_score: score.overallScore.toString(),
      intent_score_apollo: score.apolloScore.toString(),
      intent_score_zoominfo: score.zoomInfoScore.toString(),
      intent_trend: score.trend,
      intent_top_topics: score.topTopics.map((t) => t.topic).join('; '),
      intent_last_updated: score.lastUpdated,
    },
  });
}

/**
 * Get stored tokens (for internal use/testing)
 */
export function getStoredTokens(portalId: string): OAuthTokens | undefined {
  return tokenStore.get(portalId);
}

/**
 * Store tokens directly (for testing)
 */
export function storeTokens(tokens: OAuthTokens): void {
  tokenStore.set(tokens.portalId, tokens);
}

/**
 * Clear all tokens (for testing)
 */
export function clearAllTokens(): void {
  tokenStore.clear();
}
