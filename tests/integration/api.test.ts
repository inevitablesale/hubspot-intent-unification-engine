import request from 'supertest';
import { createApp } from '../../src/app';
import { clearAllSignals } from '../../src/services/scoringEngine';
import { clearAllEnrichmentData } from '../../src/services/enrichmentSync';

const app = createApp();

describe('API Integration Tests', () => {
  beforeEach(() => {
    clearAllSignals();
    clearAllEnrichmentData();
  });

  describe('Health Check', () => {
    it('GET /health should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Root Endpoint', () => {
    it('GET / should return API documentation', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('HubSpot Intent Unification Engine');
      expect(response.body.endpoints).toBeDefined();
    });
  });

  describe('Sync Endpoints', () => {
    describe('POST /sync/apollo/intent', () => {
      it('should process Apollo intent signals', async () => {
        const response = await request(app)
          .post('/sync/apollo/intent')
          .send({
            signals: [
              {
                companyId: 'company-1',
                companyName: 'Test Company',
                topic: 'Cloud Computing',
                signalStrength: 75,
              },
            ],
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.signalsProcessed).toBe(1);
      });

      it('should return 400 for missing signals', async () => {
        const response = await request(app)
          .post('/sync/apollo/intent')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid request');
      });
    });

    describe('POST /sync/zoominfo/intent', () => {
      it('should process ZoomInfo intent signals', async () => {
        const response = await request(app)
          .post('/sync/zoominfo/intent')
          .send({
            signals: [
              {
                companyId: 'company-1',
                companyName: 'Test Company',
                topic: 'AI',
                signalStrength: 80,
              },
            ],
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.signalsProcessed).toBe(1);
      });
    });

    describe('GET /sync/scores', () => {
      it('should return all scores', async () => {
        // First, add some signals
        await request(app)
          .post('/sync/apollo/intent')
          .send({
            signals: [
              {
                companyId: 'company-1',
                companyName: 'Test Company',
                topic: 'Cloud',
                signalStrength: 75,
              },
            ],
          });

        const response = await request(app).get('/sync/scores');

        expect(response.status).toBe(200);
        expect(response.body.count).toBe(1);
        expect(response.body.scores).toHaveLength(1);
      });
    });

    describe('GET /sync/scores/:companyId', () => {
      it('should return score for specific company', async () => {
        await request(app)
          .post('/sync/apollo/intent')
          .send({
            signals: [
              {
                companyId: 'company-1',
                companyName: 'Test Company',
                topic: 'Cloud',
                signalStrength: 75,
              },
            ],
          });

        const response = await request(app).get('/sync/scores/company-1');

        expect(response.status).toBe(200);
        expect(response.body.companyId).toBe('company-1');
        expect(response.body.overallScore).toBeDefined();
      });

      it('should return 404 for unknown company', async () => {
        const response = await request(app).get('/sync/scores/unknown');

        expect(response.status).toBe(404);
      });
    });

    describe('POST /sync/apollo/enrichment', () => {
      it('should process Apollo enrichment data', async () => {
        const response = await request(app)
          .post('/sync/apollo/enrichment')
          .send({
            enrichments: [
              {
                entityType: 'company',
                entityId: 'company-1',
                data: {
                  employeeCount: 500,
                  industry: 'Technology',
                },
              },
            ],
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.enrichmentsProcessed).toBe(1);
      });

      it('should detect deltas on subsequent enrichments', async () => {
        // First enrichment
        await request(app)
          .post('/sync/apollo/enrichment')
          .send({
            enrichments: [
              {
                entityType: 'company',
                entityId: 'company-1',
                data: { employeeCount: 500 },
              },
            ],
          });

        // Second enrichment with changes
        const response = await request(app)
          .post('/sync/apollo/enrichment')
          .send({
            enrichments: [
              {
                entityType: 'company',
                entityId: 'company-1',
                data: { employeeCount: 600 },
              },
            ],
          });

        expect(response.status).toBe(200);
        expect(response.body.deltasDetected).toBe(1);
        expect(response.body.deltas).toHaveLength(1);
      });
    });

    describe('GET /sync/enrichment/merged/:entityType/:entityId', () => {
      it('should return merged enrichment data', async () => {
        await request(app)
          .post('/sync/apollo/enrichment')
          .send({
            enrichments: [
              {
                entityType: 'company',
                entityId: 'company-1',
                data: { employeeCount: 500, industry: 'Tech' },
              },
            ],
          });

        await request(app)
          .post('/sync/zoominfo/enrichment')
          .send({
            enrichments: [
              {
                entityType: 'company',
                entityId: 'company-1',
                data: { employeeCount: 600, annualRevenue: 50000000 },
              },
            ],
          });

        const response = await request(app).get('/sync/enrichment/merged/company/company-1');

        expect(response.status).toBe(200);
        expect(response.body.data.employeeCount).toBe(600); // ZoomInfo wins by default
        expect(response.body.data.industry).toBe('Tech');
        expect(response.body.data.annualRevenue).toBe(50000000);
      });

      it('should return 400 for invalid entity type', async () => {
        const response = await request(app).get('/sync/enrichment/merged/invalid/id');

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Scoring Endpoints', () => {
    describe('POST /scoring/icp', () => {
      it('should calculate ICP match', async () => {
        const response = await request(app)
          .post('/scoring/icp')
          .send({
            companyData: {
              id: 'company-1',
              employeeCount: 500,
              industry: 'Technology',
              annualRevenue: 50000000,
              domain: 'example.com',
              country: 'United States',
            },
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.result.tier).toBe('A');
        expect(response.body.result.matchScore).toBe(100);
      });

      it('should return 400 for missing company data', async () => {
        const response = await request(app)
          .post('/scoring/icp')
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe('POST /scoring/icp/batch', () => {
      it('should calculate ICP match for multiple companies', async () => {
        const response = await request(app)
          .post('/scoring/icp/batch')
          .send({
            companies: [
              { id: '1', employeeCount: 500, industry: 'Technology' },
              { id: '2', employeeCount: 50, industry: 'Retail' },
            ],
          });

        expect(response.status).toBe(200);
        expect(response.body.count).toBe(2);
        expect(response.body.results).toHaveLength(2);
      });
    });

    describe('POST /scoring/persona', () => {
      it('should calculate persona score', async () => {
        const response = await request(app)
          .post('/scoring/persona')
          .send({
            contactData: {
              id: 'contact-1',
              email: 'ceo@example.com',
              title: 'CEO',
              department: 'Executive',
              seniority: 'C-Level',
            },
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.result.personaType).toBe('Decision Maker');
      });

      it('should return 400 for missing contact data', async () => {
        const response = await request(app)
          .post('/scoring/persona')
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe('POST /scoring/persona/batch', () => {
      it('should calculate persona scores for multiple contacts', async () => {
        const response = await request(app)
          .post('/scoring/persona/batch')
          .send({
            contacts: [
              { id: '1', title: 'CEO', department: 'Executive' },
              { id: '2', title: 'Engineer', department: 'Engineering' },
            ],
          });

        expect(response.status).toBe(200);
        expect(response.body.count).toBe(2);
        expect(response.body.results).toHaveLength(2);
      });
    });
  });

  describe('CRM Card Endpoints', () => {
    describe('GET /crm-cards/intent-trends', () => {
      it('should return CRM card data for company', async () => {
        // Add signals first
        await request(app)
          .post('/sync/apollo/intent')
          .send({
            signals: [
              {
                companyId: '12345',
                companyName: 'Test Company',
                topic: 'Cloud',
                signalStrength: 75,
              },
            ],
          });

        const response = await request(app)
          .get('/crm-cards/intent-trends')
          .query({
            associatedObjectId: '12345',
            associatedObjectType: 'COMPANY',
          });

        expect(response.status).toBe(200);
        expect(response.body.results).toBeDefined();
        expect(response.body.results.length).toBeGreaterThan(0);
      });

      it('should return empty results for non-company object type', async () => {
        const response = await request(app)
          .get('/crm-cards/intent-trends')
          .query({
            associatedObjectId: '12345',
            associatedObjectType: 'CONTACT',
          });

        expect(response.status).toBe(200);
        expect(response.body.results).toHaveLength(0);
      });
    });

    describe('GET /crm-cards/icp-match', () => {
      it('should return ICP match CRM card data', async () => {
        // Add enrichment first
        await request(app)
          .post('/sync/apollo/enrichment')
          .send({
            enrichments: [
              {
                entityType: 'company',
                entityId: '12345',
                data: {
                  employeeCount: 500,
                  industry: 'Technology',
                },
              },
            ],
          });

        const response = await request(app)
          .get('/crm-cards/icp-match')
          .query({
            associatedObjectId: '12345',
            associatedObjectType: 'COMPANY',
          });

        expect(response.status).toBe(200);
        expect(response.body.results).toBeDefined();
      });
    });

    describe('GET /crm-cards/persona', () => {
      it('should return persona CRM card data', async () => {
        // Add enrichment first
        await request(app)
          .post('/sync/apollo/enrichment')
          .send({
            enrichments: [
              {
                entityType: 'contact',
                entityId: '12345',
                data: {
                  title: 'CEO',
                  department: 'Executive',
                },
              },
            ],
          });

        const response = await request(app)
          .get('/crm-cards/persona')
          .query({
            associatedObjectId: '12345',
            associatedObjectType: 'CONTACT',
          });

        expect(response.status).toBe(200);
        expect(response.body.results).toBeDefined();
      });
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });
  });
});
