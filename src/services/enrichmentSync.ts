import { EnrichmentData, EnrichmentDelta, FieldChange } from '../models/types';

/**
 * In-memory store for enrichment data (in production, use a database)
 */
const enrichmentStore: Map<string, EnrichmentData> = new Map();

/**
 * Fields to track for enrichment
 */
const trackableFields = [
  'employeeCount',
  'annualRevenue',
  'industry',
  'description',
  'linkedinUrl',
  'website',
  'phone',
  'address',
  'city',
  'state',
  'country',
  'postalCode',
  'foundedYear',
  'technologies',
  'fundingTotal',
  'lastFundingDate',
  'title',
  'department',
  'seniority',
];

/**
 * Generate a unique key for enrichment data
 */
function getEnrichmentKey(
  entityType: 'company' | 'contact',
  entityId: string,
  source: 'apollo' | 'zoominfo'
): string {
  return `${entityType}:${entityId}:${source}`;
}

/**
 * Store enrichment data and detect deltas
 */
export function storeEnrichmentData(
  enrichment: EnrichmentData
): EnrichmentDelta | null {
  const key = getEnrichmentKey(
    enrichment.entityType,
    enrichment.entityId,
    enrichment.source
  );
  const existing = enrichmentStore.get(key);
  
  if (!existing) {
    enrichmentStore.set(key, enrichment);
    return null; // No delta for first enrichment
  }

  const changes = detectChanges(existing.data, enrichment.data);
  enrichmentStore.set(key, enrichment);

  if (changes.length === 0) {
    return null;
  }

  return {
    entityType: enrichment.entityType,
    entityId: enrichment.entityId,
    hubspotId: enrichment.data.hubspotId as string | undefined,
    source: enrichment.source,
    changes,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Detect changes between old and new data
 */
function detectChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const field of trackableFields) {
    const oldValue = oldData[field];
    const newValue = newData[field];

    if (!deepEqual(oldValue, newValue)) {
      changes.push({
        field,
        oldValue,
        newValue,
      });
    }
  }

  return changes;
}

/**
 * Deep equality check for comparing values
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined && b === undefined) return true;
  if (a === null && b === null) return true;
  if (a === undefined || b === undefined) return false;
  if (a === null || b === null) return false;

  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => deepEqual(val, b[idx]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }

  return false;
}

/**
 * Get stored enrichment data
 */
export function getEnrichmentData(
  entityType: 'company' | 'contact',
  entityId: string,
  source: 'apollo' | 'zoominfo'
): EnrichmentData | null {
  const key = getEnrichmentKey(entityType, entityId, source);
  return enrichmentStore.get(key) || null;
}

/**
 * Get all enrichment data for an entity
 */
export function getAllEnrichmentForEntity(
  entityType: 'company' | 'contact',
  entityId: string
): EnrichmentData[] {
  const results: EnrichmentData[] = [];
  const sources: ('apollo' | 'zoominfo')[] = ['apollo', 'zoominfo'];

  for (const source of sources) {
    const data = getEnrichmentData(entityType, entityId, source);
    if (data) {
      results.push(data);
    }
  }

  return results;
}

/**
 * Merge enrichment data from multiple sources
 * Priority: zoominfo > apollo (can be configured)
 */
export function mergeEnrichmentData(
  entityType: 'company' | 'contact',
  entityId: string,
  prioritySource: 'apollo' | 'zoominfo' = 'zoominfo'
): Record<string, unknown> {
  const allData = getAllEnrichmentForEntity(entityType, entityId);
  if (allData.length === 0) return {};

  const merged: Record<string, unknown> = {};
  const secondarySource = prioritySource === 'zoominfo' ? 'apollo' : 'zoominfo';

  // First, apply secondary source data
  const secondaryData = allData.find((d) => d.source === secondarySource);
  if (secondaryData) {
    Object.assign(merged, secondaryData.data);
  }

  // Then, override with priority source data
  const primaryData = allData.find((d) => d.source === prioritySource);
  if (primaryData) {
    for (const [key, value] of Object.entries(primaryData.data)) {
      if (value !== undefined && value !== null && value !== '') {
        merged[key] = value;
      }
    }
  }

  return merged;
}

/**
 * Clear all enrichment data (useful for testing)
 */
export function clearAllEnrichmentData(): void {
  enrichmentStore.clear();
}

/**
 * Process batch enrichment data
 */
export function processBatchEnrichment(
  enrichments: EnrichmentData[]
): EnrichmentDelta[] {
  const deltas: EnrichmentDelta[] = [];

  for (const enrichment of enrichments) {
    const delta = storeEnrichmentData(enrichment);
    if (delta) {
      deltas.push(delta);
    }
  }

  return deltas;
}
