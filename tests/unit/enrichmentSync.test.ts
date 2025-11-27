import {
  storeEnrichmentData,
  getEnrichmentData,
  getAllEnrichmentForEntity,
  mergeEnrichmentData,
  clearAllEnrichmentData,
  processBatchEnrichment,
} from '../../src/services/enrichmentSync';
import { EnrichmentData } from '../../src/models/types';

describe('Enrichment Sync', () => {
  beforeEach(() => {
    clearAllEnrichmentData();
  });

  describe('storeEnrichmentData', () => {
    it('should store enrichment data and return null for first entry', () => {
      const enrichment: EnrichmentData = {
        entityType: 'company',
        entityId: 'company-1',
        source: 'apollo',
        data: {
          employeeCount: 500,
          industry: 'Technology',
        },
        timestamp: new Date().toISOString(),
      };

      const delta = storeEnrichmentData(enrichment);

      expect(delta).toBeNull();
    });

    it('should detect changes and return delta', () => {
      const enrichment1: EnrichmentData = {
        entityType: 'company',
        entityId: 'company-1',
        source: 'apollo',
        data: {
          employeeCount: 500,
          industry: 'Technology',
        },
        timestamp: new Date().toISOString(),
      };

      const enrichment2: EnrichmentData = {
        entityType: 'company',
        entityId: 'company-1',
        source: 'apollo',
        data: {
          employeeCount: 600, // Changed
          industry: 'Technology',
        },
        timestamp: new Date().toISOString(),
      };

      storeEnrichmentData(enrichment1);
      const delta = storeEnrichmentData(enrichment2);

      expect(delta).not.toBeNull();
      expect(delta?.changes).toHaveLength(1);
      expect(delta?.changes[0]).toEqual({
        field: 'employeeCount',
        oldValue: 500,
        newValue: 600,
      });
    });

    it('should return null when no changes', () => {
      const enrichment: EnrichmentData = {
        entityType: 'company',
        entityId: 'company-1',
        source: 'apollo',
        data: {
          employeeCount: 500,
          industry: 'Technology',
        },
        timestamp: new Date().toISOString(),
      };

      storeEnrichmentData(enrichment);
      const delta = storeEnrichmentData({
        ...enrichment,
        timestamp: new Date().toISOString(),
      });

      expect(delta).toBeNull();
    });
  });

  describe('getEnrichmentData', () => {
    it('should retrieve stored enrichment data', () => {
      const enrichment: EnrichmentData = {
        entityType: 'company',
        entityId: 'company-1',
        source: 'apollo',
        data: {
          employeeCount: 500,
        },
        timestamp: new Date().toISOString(),
      };

      storeEnrichmentData(enrichment);
      const retrieved = getEnrichmentData('company', 'company-1', 'apollo');

      expect(retrieved).toEqual(enrichment);
    });

    it('should return null for non-existent data', () => {
      const retrieved = getEnrichmentData('company', 'unknown', 'apollo');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAllEnrichmentForEntity', () => {
    it('should return enrichment from all sources', () => {
      const apolloEnrichment: EnrichmentData = {
        entityType: 'company',
        entityId: 'company-1',
        source: 'apollo',
        data: { employeeCount: 500 },
        timestamp: new Date().toISOString(),
      };

      const zoomInfoEnrichment: EnrichmentData = {
        entityType: 'company',
        entityId: 'company-1',
        source: 'zoominfo',
        data: { annualRevenue: 50000000 },
        timestamp: new Date().toISOString(),
      };

      storeEnrichmentData(apolloEnrichment);
      storeEnrichmentData(zoomInfoEnrichment);

      const all = getAllEnrichmentForEntity('company', 'company-1');

      expect(all).toHaveLength(2);
    });

    it('should return empty array for non-existent entity', () => {
      const all = getAllEnrichmentForEntity('company', 'unknown');
      expect(all).toHaveLength(0);
    });
  });

  describe('mergeEnrichmentData', () => {
    it('should merge data with ZoomInfo priority by default', () => {
      const apolloEnrichment: EnrichmentData = {
        entityType: 'company',
        entityId: 'company-1',
        source: 'apollo',
        data: {
          employeeCount: 500,
          industry: 'Tech',
          website: 'apollo.example.com',
        },
        timestamp: new Date().toISOString(),
      };

      const zoomInfoEnrichment: EnrichmentData = {
        entityType: 'company',
        entityId: 'company-1',
        source: 'zoominfo',
        data: {
          employeeCount: 600,
          annualRevenue: 50000000,
        },
        timestamp: new Date().toISOString(),
      };

      storeEnrichmentData(apolloEnrichment);
      storeEnrichmentData(zoomInfoEnrichment);

      const merged = mergeEnrichmentData('company', 'company-1');

      expect(merged.employeeCount).toBe(600); // ZoomInfo wins
      expect(merged.industry).toBe('Tech'); // Only in Apollo
      expect(merged.annualRevenue).toBe(50000000); // Only in ZoomInfo
      expect(merged.website).toBe('apollo.example.com'); // Only in Apollo
    });

    it('should merge data with Apollo priority when specified', () => {
      const apolloEnrichment: EnrichmentData = {
        entityType: 'company',
        entityId: 'company-1',
        source: 'apollo',
        data: {
          employeeCount: 500,
        },
        timestamp: new Date().toISOString(),
      };

      const zoomInfoEnrichment: EnrichmentData = {
        entityType: 'company',
        entityId: 'company-1',
        source: 'zoominfo',
        data: {
          employeeCount: 600,
        },
        timestamp: new Date().toISOString(),
      };

      storeEnrichmentData(apolloEnrichment);
      storeEnrichmentData(zoomInfoEnrichment);

      const merged = mergeEnrichmentData('company', 'company-1', 'apollo');

      expect(merged.employeeCount).toBe(500); // Apollo wins
    });

    it('should return empty object for non-existent entity', () => {
      const merged = mergeEnrichmentData('company', 'unknown');
      expect(merged).toEqual({});
    });
  });

  describe('processBatchEnrichment', () => {
    it('should process multiple enrichments and return deltas', () => {
      // First batch - no deltas
      const batch1: EnrichmentData[] = [
        {
          entityType: 'company',
          entityId: 'company-1',
          source: 'apollo',
          data: { employeeCount: 500 },
          timestamp: new Date().toISOString(),
        },
        {
          entityType: 'company',
          entityId: 'company-2',
          source: 'apollo',
          data: { employeeCount: 300 },
          timestamp: new Date().toISOString(),
        },
      ];

      const deltas1 = processBatchEnrichment(batch1);
      expect(deltas1).toHaveLength(0);

      // Second batch - one delta
      const batch2: EnrichmentData[] = [
        {
          entityType: 'company',
          entityId: 'company-1',
          source: 'apollo',
          data: { employeeCount: 600 }, // Changed
          timestamp: new Date().toISOString(),
        },
        {
          entityType: 'company',
          entityId: 'company-2',
          source: 'apollo',
          data: { employeeCount: 300 }, // Same
          timestamp: new Date().toISOString(),
        },
      ];

      const deltas2 = processBatchEnrichment(batch2);
      expect(deltas2).toHaveLength(1);
      expect(deltas2[0].entityId).toBe('company-1');
    });
  });
});
