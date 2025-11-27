import {
  IntentSignal,
  UnifiedIntentScore,
  TopicScore,
  AwarenessSpike,
} from '../models/types';

/**
 * In-memory store for intent signals (in production, use a database)
 */
const signalStore: Map<string, IntentSignal[]> = new Map();
const scoreCache: Map<string, UnifiedIntentScore> = new Map();

/**
 * Configuration for the scoring engine
 */
export interface ScoringConfig {
  apolloWeight: number;
  zoomInfoWeight: number;
  decayDays: number;
  spikeThresholdPercent: number;
}

/**
 * Default scoring configuration:
 * - apolloWeight (0.5): Weight for Apollo signals in unified score calculation
 * - zoomInfoWeight (0.5): Weight for ZoomInfo signals in unified score calculation  
 * - decayDays (30): Number of days over which signal strength decays to zero
 * - spikeThresholdPercent (25): Minimum percentage increase to trigger awareness spike
 */
const defaultConfig: ScoringConfig = {
  apolloWeight: parseFloat(process.env.SCORING_APOLLO_WEIGHT || '0.5'),
  zoomInfoWeight: parseFloat(process.env.SCORING_ZOOMINFO_WEIGHT || '0.5'),
  decayDays: parseInt(process.env.SCORING_DECAY_DAYS || '30', 10),
  spikeThresholdPercent: parseInt(process.env.SCORING_SPIKE_THRESHOLD || '25', 10),
};

/**
 * Add an intent signal to the store
 */
export function addIntentSignal(signal: IntentSignal): void {
  const key = signal.companyId;
  const existing = signalStore.get(key) || [];
  existing.push(signal);
  signalStore.set(key, existing);
}

/**
 * Add multiple intent signals
 */
export function addIntentSignals(signals: IntentSignal[]): void {
  for (const signal of signals) {
    addIntentSignal(signal);
  }
}

/**
 * Get all signals for a company
 */
export function getSignalsForCompany(companyId: string): IntentSignal[] {
  return signalStore.get(companyId) || [];
}

/**
 * Clear all signals (useful for testing)
 */
export function clearAllSignals(): void {
  signalStore.clear();
  scoreCache.clear();
}

/**
 * Calculate time-decay factor for a signal
 */
function calculateDecay(signalDate: Date, decayDays: number): number {
  const now = new Date();
  const daysDiff = (now.getTime() - signalDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff <= 0) return 1;
  if (daysDiff >= decayDays) return 0;
  return 1 - (daysDiff / decayDays);
}

/**
 * Calculate the unified intent score for a company
 */
export function calculateUnifiedScore(
  companyId: string,
  config: ScoringConfig = defaultConfig
): UnifiedIntentScore | null {
  const signals = getSignalsForCompany(companyId);
  if (signals.length === 0) return null;

  const apolloSignals = signals.filter((s) => s.source === 'apollo');
  const zoomInfoSignals = signals.filter((s) => s.source === 'zoominfo');

  // Calculate weighted scores with time decay
  const apolloScore = calculateSourceScore(apolloSignals, config.decayDays);
  const zoomInfoScore = calculateSourceScore(zoomInfoSignals, config.decayDays);

  // Combine scores with weights
  const overallScore = Math.round(
    apolloScore * config.apolloWeight +
    zoomInfoScore * config.zoomInfoWeight
  );

  // Calculate top topics
  const topTopics = calculateTopTopics(signals);

  // Determine trend based on cached previous score
  const previousScore = scoreCache.get(companyId);
  const trend = determineTrend(overallScore, previousScore?.overallScore);

  // Check for spike
  const isSpike = checkForSpike(
    overallScore,
    previousScore?.overallScore,
    config.spikeThresholdPercent
  );

  const companyName = signals[0]?.companyName || 'Unknown';
  const domain = signals.find((s) => s.domain)?.domain;

  const score: UnifiedIntentScore = {
    companyId,
    companyName,
    domain,
    overallScore,
    apolloScore: Math.round(apolloScore),
    zoomInfoScore: Math.round(zoomInfoScore),
    topTopics,
    signalCount: signals.length,
    lastUpdated: new Date().toISOString(),
    trend,
    isSpike,
  };

  scoreCache.set(companyId, score);
  return score;
}

/**
 * Calculate score for signals from a single source
 */
function calculateSourceScore(signals: IntentSignal[], decayDays: number): number {
  if (signals.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const signal of signals) {
    const decay = calculateDecay(new Date(signal.timestamp), decayDays);
    weightedSum += signal.signalStrength * decay;
    totalWeight += decay;
  }

  if (totalWeight === 0) return 0;
  return Math.min(100, weightedSum / totalWeight);
}

/**
 * Calculate top topics from signals
 */
function calculateTopTopics(signals: IntentSignal[]): TopicScore[] {
  const topicMap = new Map<string, { score: number; sources: Set<string> }>();

  for (const signal of signals) {
    const existing = topicMap.get(signal.topic) || {
      score: 0,
      sources: new Set<string>(),
    };
    existing.score += signal.signalStrength;
    existing.sources.add(signal.source);
    topicMap.set(signal.topic, existing);
  }

  const topics: TopicScore[] = [];
  for (const [topic, data] of topicMap) {
    topics.push({
      topic,
      score: Math.min(100, Math.round(data.score / signals.filter((s) => s.topic === topic).length)),
      sources: Array.from(data.sources) as ('apollo' | 'zoominfo')[],
    });
  }

  return topics.sort((a, b) => b.score - a.score).slice(0, 5);
}

/**
 * Determine the score trend
 */
function determineTrend(
  currentScore: number,
  previousScore?: number
): 'increasing' | 'stable' | 'decreasing' {
  if (previousScore === undefined) return 'stable';
  const diff = currentScore - previousScore;
  if (diff > 5) return 'increasing';
  if (diff < -5) return 'decreasing';
  return 'stable';
}

/**
 * Check if there's an awareness spike
 */
function checkForSpike(
  currentScore: number,
  previousScore: number | undefined,
  thresholdPercent: number
): boolean {
  if (previousScore === undefined || previousScore === 0) return false;
  const percentIncrease = ((currentScore - previousScore) / previousScore) * 100;
  return percentIncrease >= thresholdPercent;
}

/**
 * Detect awareness spikes for all companies
 */
export function detectAwarenessSpikes(
  config: ScoringConfig = defaultConfig
): AwarenessSpike[] {
  const spikes: AwarenessSpike[] = [];

  for (const companyId of signalStore.keys()) {
    const previousScore = scoreCache.get(companyId);
    const currentScoreObj = calculateUnifiedScore(companyId, config);

    if (currentScoreObj && currentScoreObj.isSpike && previousScore) {
      const percentageIncrease =
        previousScore.overallScore > 0
          ? ((currentScoreObj.overallScore - previousScore.overallScore) /
              previousScore.overallScore) *
            100
          : 0;

      spikes.push({
        companyId,
        hubspotCompanyId: currentScoreObj.hubspotCompanyId,
        companyName: currentScoreObj.companyName,
        previousScore: previousScore.overallScore,
        currentScore: currentScoreObj.overallScore,
        percentageIncrease: Math.round(percentageIncrease),
        triggeringTopics: currentScoreObj.topTopics.map((t) => t.topic),
        timestamp: new Date().toISOString(),
      });
    }
  }

  return spikes;
}

/**
 * Get all unified scores
 */
export function getAllUnifiedScores(
  config: ScoringConfig = defaultConfig
): UnifiedIntentScore[] {
  const scores: UnifiedIntentScore[] = [];
  for (const companyId of signalStore.keys()) {
    const score = calculateUnifiedScore(companyId, config);
    if (score) scores.push(score);
  }
  return scores.sort((a, b) => b.overallScore - a.overallScore);
}
