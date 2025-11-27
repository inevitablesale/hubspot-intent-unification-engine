import {
  calculateICPMatch,
  calculatePersonaScore,
  getICPProfile,
  getPersonaProfiles,
} from '../../src/services/icpPersonaScoring';

describe('ICP and Persona Scoring', () => {
  describe('calculateICPMatch', () => {
    it('should calculate ICP match for a perfect match company', () => {
      const companyData = {
        id: 'company-1',
        employeeCount: 500,
        industry: 'Technology',
        annualRevenue: 50000000,
        domain: 'example.com',
        country: 'United States',
      };

      const result = calculateICPMatch(companyData);

      expect(result.companyId).toBe('company-1');
      expect(result.matchScore).toBe(100);
      expect(result.tier).toBe('A');
      expect(result.matchedCriteria).toHaveLength(5);
      expect(result.unmatchedCriteria).toHaveLength(0);
    });

    it('should calculate ICP match for a partial match company', () => {
      const companyData = {
        id: 'company-2',
        employeeCount: 500,
        industry: 'Retail', // Not in ICP
        annualRevenue: 50000000,
        domain: 'example.com',
        country: 'Germany', // Not in ICP
      };

      const result = calculateICPMatch(companyData);

      expect(result.companyId).toBe('company-2');
      expect(result.matchScore).toBeLessThan(100);
      expect(result.matchedCriteria.length).toBeGreaterThan(0);
      expect(result.unmatchedCriteria.length).toBeGreaterThan(0);
    });

    it('should assign correct tiers based on score', () => {
      // Tier A: 80+
      const tierACompany = {
        id: 'a',
        employeeCount: 500,
        industry: 'Technology',
        annualRevenue: 50000000,
        domain: 'example.com',
        country: 'United States',
      };
      expect(calculateICPMatch(tierACompany).tier).toBe('A');

      // Tier D: < 40
      const tierDCompany = {
        id: 'd',
        employeeCount: 5, // Too small
        industry: 'Agriculture', // Not in ICP
        annualRevenue: 10000, // Too small
        // No domain
        country: 'Zimbabwe', // Not in ICP
      };
      expect(calculateICPMatch(tierDCompany).tier).toBe('D');
    });

    it('should handle missing fields gracefully', () => {
      const companyData = {
        id: 'company-3',
      };

      const result = calculateICPMatch(companyData);

      expect(result.companyId).toBe('company-3');
      expect(result.matchScore).toBe(0);
      expect(result.tier).toBe('D');
      expect(result.unmatchedCriteria).toHaveLength(5);
    });

    it('should include HubSpot ID when provided', () => {
      const companyData = {
        id: 'company-4',
        hubspotId: 'hs-123',
        employeeCount: 500,
      };

      const result = calculateICPMatch(companyData);

      expect(result.hubspotCompanyId).toBe('hs-123');
    });
  });

  describe('calculatePersonaScore', () => {
    it('should identify Decision Maker persona', () => {
      const contactData = {
        id: 'contact-1',
        email: 'ceo@example.com',
        title: 'CEO',
        department: 'Executive',
        seniority: 'C-Level',
      };

      const result = calculatePersonaScore(contactData);

      expect(result.contactId).toBe('contact-1');
      expect(result.email).toBe('ceo@example.com');
      expect(result.personaType).toBe('Decision Maker');
      expect(result.matchScore).toBeGreaterThan(50);
    });

    it('should identify Technical Evaluator persona', () => {
      const contactData = {
        id: 'contact-2',
        email: 'engineer@example.com',
        title: 'Senior Software Engineer',
        department: 'Engineering',
        seniority: 'Senior',
      };

      const result = calculatePersonaScore(contactData);

      expect(result.personaType).toBe('Technical Evaluator');
      expect(result.matchScore).toBeGreaterThan(50);
    });

    it('should identify End User persona', () => {
      const contactData = {
        id: 'contact-3',
        email: 'manager@example.com',
        title: 'Marketing Manager',
        department: 'Marketing',
        seniority: 'Manager',
      };

      const result = calculatePersonaScore(contactData);

      expect(result.personaType).toBe('End User');
    });

    it('should return Unknown persona for unmatched contacts', () => {
      const contactData = {
        id: 'contact-4',
        email: 'unknown@example.com',
      };

      const result = calculatePersonaScore(contactData);

      // Even with no matching fields, it will still pick the highest scoring persona
      expect(result.contactId).toBe('contact-4');
    });

    it('should include HubSpot ID when provided', () => {
      const contactData = {
        id: 'contact-5',
        hubspotId: 'hs-456',
        email: 'test@example.com',
        title: 'VP Sales',
      };

      const result = calculatePersonaScore(contactData);

      expect(result.hubspotContactId).toBe('hs-456');
    });

    it('should include attributes with match status', () => {
      const contactData = {
        id: 'contact-6',
        email: 'director@example.com',
        title: 'Director of Engineering',
        department: 'Engineering',
        seniority: 'Director',
      };

      const result = calculatePersonaScore(contactData);

      expect(result.attributes).toHaveLength(3);
      expect(result.attributes.some((a) => a.matched)).toBe(true);
    });
  });

  describe('getICPProfile', () => {
    it('should return the default ICP profile', () => {
      const profile = getICPProfile();

      expect(profile.name).toBe('Default B2B SaaS ICP');
      expect(profile.criteria).toHaveLength(5);
    });
  });

  describe('getPersonaProfiles', () => {
    it('should return all persona profiles', () => {
      const profiles = getPersonaProfiles();

      expect(profiles).toHaveLength(3);
      expect(profiles.map((p) => p.name)).toContain('Decision Maker');
      expect(profiles.map((p) => p.name)).toContain('Technical Evaluator');
      expect(profiles.map((p) => p.name)).toContain('End User');
    });
  });
});
