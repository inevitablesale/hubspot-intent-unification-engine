/**
 * Intent signal from Apollo or ZoomInfo
 */
export interface IntentSignal {
  source: 'apollo' | 'zoominfo';
  companyId: string;
  companyName: string;
  domain?: string;
  topic: string;
  signalStrength: number; // 0-100
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Unified intent score combining signals from multiple sources
 */
export interface UnifiedIntentScore {
  companyId: string;
  hubspotCompanyId?: string;
  companyName: string;
  domain?: string;
  overallScore: number; // 0-100
  apolloScore: number;
  zoomInfoScore: number;
  topTopics: TopicScore[];
  signalCount: number;
  lastUpdated: string;
  trend: 'increasing' | 'stable' | 'decreasing';
  isSpike: boolean;
}

/**
 * Topic-level intent score
 */
export interface TopicScore {
  topic: string;
  score: number;
  sources: ('apollo' | 'zoominfo')[];
}

/**
 * ICP (Ideal Customer Profile) match result
 */
export interface ICPMatch {
  companyId: string;
  hubspotCompanyId?: string;
  matchScore: number; // 0-100
  matchedCriteria: ICPCriterion[];
  unmatchedCriteria: ICPCriterion[];
  tier: 'A' | 'B' | 'C' | 'D';
}

/**
 * Individual ICP criterion
 */
export interface ICPCriterion {
  name: string;
  weight: number;
  matched: boolean;
  actualValue?: string | number;
  expectedValue?: string | number;
}

/**
 * Persona score for a contact
 */
export interface PersonaScore {
  contactId: string;
  hubspotContactId?: string;
  email: string;
  personaType: string;
  matchScore: number; // 0-100
  attributes: PersonaAttribute[];
}

/**
 * Individual persona attribute
 */
export interface PersonaAttribute {
  name: string;
  value: string;
  weight: number;
  matched: boolean;
}

/**
 * Enrichment data for a company or contact
 */
export interface EnrichmentData {
  entityType: 'company' | 'contact';
  entityId: string;
  source: 'apollo' | 'zoominfo';
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Delta between current and new enrichment data
 */
export interface EnrichmentDelta {
  entityType: 'company' | 'contact';
  entityId: string;
  hubspotId?: string;
  source: 'apollo' | 'zoominfo';
  changes: FieldChange[];
  timestamp: string;
}

/**
 * Individual field change
 */
export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Awareness spike alert
 */
export interface AwarenessSpike {
  companyId: string;
  hubspotCompanyId?: string;
  companyName: string;
  previousScore: number;
  currentScore: number;
  percentageIncrease: number;
  triggeringTopics: string[];
  timestamp: string;
}

/**
 * OAuth tokens stored for a portal
 */
export interface OAuthTokens {
  portalId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * CRM Card data response
 */
export interface CRMCardResponse {
  results: CRMCardSection[];
  primaryAction?: CRMCardAction;
  secondaryActions?: CRMCardAction[];
}

/**
 * CRM Card section
 */
export interface CRMCardSection {
  objectId: number;
  title: string;
  properties?: CRMCardProperty[];
  actions?: CRMCardAction[];
}

/**
 * CRM Card property
 */
export interface CRMCardProperty {
  label: string;
  dataType: 'STRING' | 'NUMBER' | 'DATE' | 'CURRENCY' | 'LINK' | 'STATUS';
  value: string | number;
}

/**
 * CRM Card action
 */
export interface CRMCardAction {
  type: 'IFRAME' | 'ACTION_HOOK' | 'EXTERNAL_URL';
  width?: number;
  height?: number;
  uri: string;
  label: string;
}
