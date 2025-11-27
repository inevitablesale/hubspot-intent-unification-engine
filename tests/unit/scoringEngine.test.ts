import {
  addIntentSignal,
  addIntentSignals,
  calculateUnifiedScore,
  getSignalsForCompany,
  clearAllSignals,
  getAllUnifiedScores,
  detectAwarenessSpikes,
} from '../../src/services/scoringEngine';
import { IntentSignal } from '../../src/models/types';

describe('Scoring Engine', () => {
  beforeEach(() => {
    clearAllSignals();
  });

  describe('addIntentSignal', () => {
    it('should add a signal to the store', () => {
      const signal: IntentSignal = {
        source: 'apollo',
        companyId: 'company-1',
        companyName: 'Test Company',
        topic: 'Cloud Computing',
        signalStrength: 75,
        timestamp: new Date().toISOString(),
      };

      addIntentSignal(signal);
      const signals = getSignalsForCompany('company-1');
      expect(signals).toHaveLength(1);
      expect(signals[0]).toEqual(signal);
    });

    it('should append signals for the same company', () => {
      const signal1: IntentSignal = {
        source: 'apollo',
        companyId: 'company-1',
        companyName: 'Test Company',
        topic: 'Cloud Computing',
        signalStrength: 75,
        timestamp: new Date().toISOString(),
      };

      const signal2: IntentSignal = {
        source: 'zoominfo',
        companyId: 'company-1',
        companyName: 'Test Company',
        topic: 'AI',
        signalStrength: 80,
        timestamp: new Date().toISOString(),
      };

      addIntentSignal(signal1);
      addIntentSignal(signal2);
      const signals = getSignalsForCompany('company-1');
      expect(signals).toHaveLength(2);
    });
  });

  describe('addIntentSignals', () => {
    it('should add multiple signals at once', () => {
      const signals: IntentSignal[] = [
        {
          source: 'apollo',
          companyId: 'company-1',
          companyName: 'Test Company',
          topic: 'Cloud Computing',
          signalStrength: 75,
          timestamp: new Date().toISOString(),
        },
        {
          source: 'zoominfo',
          companyId: 'company-2',
          companyName: 'Another Company',
          topic: 'AI',
          signalStrength: 80,
          timestamp: new Date().toISOString(),
        },
      ];

      addIntentSignals(signals);
      expect(getSignalsForCompany('company-1')).toHaveLength(1);
      expect(getSignalsForCompany('company-2')).toHaveLength(1);
    });
  });

  describe('calculateUnifiedScore', () => {
    it('should return null for unknown company', () => {
      const score = calculateUnifiedScore('unknown-company');
      expect(score).toBeNull();
    });

    it('should calculate score from Apollo signals only', () => {
      const signal: IntentSignal = {
        source: 'apollo',
        companyId: 'company-1',
        companyName: 'Test Company',
        topic: 'Cloud Computing',
        signalStrength: 80,
        timestamp: new Date().toISOString(),
      };

      addIntentSignal(signal);
      const score = calculateUnifiedScore('company-1');

      expect(score).not.toBeNull();
      expect(score?.companyId).toBe('company-1');
      expect(score?.companyName).toBe('Test Company');
      expect(score?.apolloScore).toBe(80);
      expect(score?.zoomInfoScore).toBe(0);
      expect(score?.overallScore).toBe(40); // 80 * 0.5 + 0 * 0.5
    });

    it('should calculate score from ZoomInfo signals only', () => {
      const signal: IntentSignal = {
        source: 'zoominfo',
        companyId: 'company-1',
        companyName: 'Test Company',
        topic: 'Cloud Computing',
        signalStrength: 60,
        timestamp: new Date().toISOString(),
      };

      addIntentSignal(signal);
      const score = calculateUnifiedScore('company-1');

      expect(score).not.toBeNull();
      expect(score?.apolloScore).toBe(0);
      expect(score?.zoomInfoScore).toBe(60);
      expect(score?.overallScore).toBe(30); // 0 * 0.5 + 60 * 0.5
    });

    it('should calculate unified score from both sources', () => {
      const apolloSignal: IntentSignal = {
        source: 'apollo',
        companyId: 'company-1',
        companyName: 'Test Company',
        topic: 'Cloud Computing',
        signalStrength: 80,
        timestamp: new Date().toISOString(),
      };

      const zoomInfoSignal: IntentSignal = {
        source: 'zoominfo',
        companyId: 'company-1',
        companyName: 'Test Company',
        topic: 'AI',
        signalStrength: 60,
        timestamp: new Date().toISOString(),
      };

      addIntentSignals([apolloSignal, zoomInfoSignal]);
      const score = calculateUnifiedScore('company-1');

      expect(score).not.toBeNull();
      expect(score?.apolloScore).toBe(80);
      expect(score?.zoomInfoScore).toBe(60);
      expect(score?.overallScore).toBe(70); // 80 * 0.5 + 60 * 0.5
      expect(score?.signalCount).toBe(2);
    });

    it('should identify top topics', () => {
      const signals: IntentSignal[] = [
        {
          source: 'apollo',
          companyId: 'company-1',
          companyName: 'Test Company',
          topic: 'Cloud Computing',
          signalStrength: 80,
          timestamp: new Date().toISOString(),
        },
        {
          source: 'zoominfo',
          companyId: 'company-1',
          companyName: 'Test Company',
          topic: 'Cloud Computing',
          signalStrength: 70,
          timestamp: new Date().toISOString(),
        },
        {
          source: 'apollo',
          companyId: 'company-1',
          companyName: 'Test Company',
          topic: 'AI',
          signalStrength: 50,
          timestamp: new Date().toISOString(),
        },
      ];

      addIntentSignals(signals);
      const score = calculateUnifiedScore('company-1');

      expect(score?.topTopics).toHaveLength(2);
      expect(score?.topTopics[0].topic).toBe('Cloud Computing');
      expect(score?.topTopics[0].sources).toContain('apollo');
      expect(score?.topTopics[0].sources).toContain('zoominfo');
    });

    it('should detect increasing trend', () => {
      // First calculation sets the baseline
      const signal1: IntentSignal = {
        source: 'apollo',
        companyId: 'company-1',
        companyName: 'Test Company',
        topic: 'Cloud Computing',
        signalStrength: 50,
        timestamp: new Date().toISOString(),
      };
      addIntentSignal(signal1);
      calculateUnifiedScore('company-1');

      // Add more signals to increase score
      const signal2: IntentSignal = {
        source: 'zoominfo',
        companyId: 'company-1',
        companyName: 'Test Company',
        topic: 'AI',
        signalStrength: 90,
        timestamp: new Date().toISOString(),
      };
      addIntentSignal(signal2);
      const score = calculateUnifiedScore('company-1');

      expect(score?.trend).toBe('increasing');
    });
  });

  describe('getAllUnifiedScores', () => {
    it('should return scores for all companies', () => {
      const signals: IntentSignal[] = [
        {
          source: 'apollo',
          companyId: 'company-1',
          companyName: 'Test Company 1',
          topic: 'Cloud Computing',
          signalStrength: 80,
          timestamp: new Date().toISOString(),
        },
        {
          source: 'zoominfo',
          companyId: 'company-2',
          companyName: 'Test Company 2',
          topic: 'AI',
          signalStrength: 60,
          timestamp: new Date().toISOString(),
        },
      ];

      addIntentSignals(signals);
      const scores = getAllUnifiedScores();

      expect(scores).toHaveLength(2);
    });

    it('should sort scores by overallScore descending', () => {
      const signals: IntentSignal[] = [
        {
          source: 'apollo',
          companyId: 'company-1',
          companyName: 'Test Company 1',
          topic: 'Cloud Computing',
          signalStrength: 50,
          timestamp: new Date().toISOString(),
        },
        {
          source: 'apollo',
          companyId: 'company-2',
          companyName: 'Test Company 2',
          topic: 'AI',
          signalStrength: 90,
          timestamp: new Date().toISOString(),
        },
      ];

      addIntentSignals(signals);
      const scores = getAllUnifiedScores();

      expect(scores[0].companyId).toBe('company-2');
      expect(scores[1].companyId).toBe('company-1');
    });
  });

  describe('detectAwarenessSpikes', () => {
    it('should return empty array when no spikes', () => {
      const signal: IntentSignal = {
        source: 'apollo',
        companyId: 'company-1',
        companyName: 'Test Company',
        topic: 'Cloud Computing',
        signalStrength: 50,
        timestamp: new Date().toISOString(),
      };

      addIntentSignal(signal);
      calculateUnifiedScore('company-1');

      const spikes = detectAwarenessSpikes();
      expect(spikes).toHaveLength(0);
    });
  });
});
