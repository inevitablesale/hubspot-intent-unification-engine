import { Router, Request, Response } from 'express';
import { IntentSignal, EnrichmentData } from '../models/types';
import {
  addIntentSignals,
  calculateUnifiedScore,
  getAllUnifiedScores,
  detectAwarenessSpikes,
} from '../services/scoringEngine';
import {
  processBatchEnrichment,
  mergeEnrichmentData,
} from '../services/enrichmentSync';
import {
  createAwarenessSpikeEvent,
  updateCompanyIntentScore,
} from '../services/hubspotService';

const router = Router();

/**
 * POST /sync/apollo/intent
 * Receive intent signals from Apollo
 */
router.post('/apollo/intent', async (req: Request, res: Response) => {
  try {
    const { signals, portalId } = req.body as {
      signals: Omit<IntentSignal, 'source'>[];
      portalId?: string;
    };

    if (!signals || !Array.isArray(signals)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'signals array is required',
      });
    }

    // Add source to each signal
    const apolloSignals: IntentSignal[] = signals.map((s) => ({
      ...s,
      source: 'apollo' as const,
      timestamp: s.timestamp || new Date().toISOString(),
    }));

    addIntentSignals(apolloSignals);

    // Calculate updated scores
    const companyIds = [...new Set(apolloSignals.map((s) => s.companyId))];
    const scores = companyIds
      .map((id) => calculateUnifiedScore(id))
      .filter((s) => s !== null);

    // Detect spikes and create timeline events if portal is connected
    const spikes = detectAwarenessSpikes();
    if (portalId && spikes.length > 0) {
      for (const spike of spikes) {
        try {
          // Note: timelineEventTemplateId would need to be configured
          await createAwarenessSpikeEvent(portalId, spike, 'awareness_spike_template');
        } catch (error) {
          console.error('Error creating timeline event:', error);
        }
      }
    }

    // Update HubSpot company properties if portal is connected
    if (portalId) {
      for (const score of scores) {
        if (score) {
          try {
            await updateCompanyIntentScore(portalId, score);
          } catch (error) {
            console.error('Error updating company intent score:', error);
          }
        }
      }
    }

    res.json({
      success: true,
      signalsProcessed: apolloSignals.length,
      companiesUpdated: scores.length,
      spikesDetected: spikes.length,
    });
  } catch (error) {
    console.error('Error processing Apollo intent signals:', error);
    res.status(500).json({
      error: 'Failed to process intent signals',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /sync/zoominfo/intent
 * Receive intent signals from ZoomInfo
 */
router.post('/zoominfo/intent', async (req: Request, res: Response) => {
  try {
    const { signals, portalId } = req.body as {
      signals: Omit<IntentSignal, 'source'>[];
      portalId?: string;
    };

    if (!signals || !Array.isArray(signals)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'signals array is required',
      });
    }

    // Add source to each signal
    const zoomInfoSignals: IntentSignal[] = signals.map((s) => ({
      ...s,
      source: 'zoominfo' as const,
      timestamp: s.timestamp || new Date().toISOString(),
    }));

    addIntentSignals(zoomInfoSignals);

    // Calculate updated scores
    const companyIds = [...new Set(zoomInfoSignals.map((s) => s.companyId))];
    const scores = companyIds
      .map((id) => calculateUnifiedScore(id))
      .filter((s) => s !== null);

    // Detect spikes and create timeline events if portal is connected
    const spikes = detectAwarenessSpikes();
    if (portalId && spikes.length > 0) {
      for (const spike of spikes) {
        try {
          await createAwarenessSpikeEvent(portalId, spike, 'awareness_spike_template');
        } catch (error) {
          console.error('Error creating timeline event:', error);
        }
      }
    }

    // Update HubSpot company properties if portal is connected
    if (portalId) {
      for (const score of scores) {
        if (score) {
          try {
            await updateCompanyIntentScore(portalId, score);
          } catch (error) {
            console.error('Error updating company intent score:', error);
          }
        }
      }
    }

    res.json({
      success: true,
      signalsProcessed: zoomInfoSignals.length,
      companiesUpdated: scores.length,
      spikesDetected: spikes.length,
    });
  } catch (error) {
    console.error('Error processing ZoomInfo intent signals:', error);
    res.status(500).json({
      error: 'Failed to process intent signals',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /sync/apollo/enrichment
 * Receive enrichment data from Apollo
 */
router.post('/apollo/enrichment', async (req: Request, res: Response) => {
  try {
    const { enrichments } = req.body as {
      enrichments: Omit<EnrichmentData, 'source'>[];
    };

    if (!enrichments || !Array.isArray(enrichments)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'enrichments array is required',
      });
    }

    // Add source to each enrichment
    const apolloEnrichments: EnrichmentData[] = enrichments.map((e) => ({
      ...e,
      source: 'apollo' as const,
      timestamp: e.timestamp || new Date().toISOString(),
    }));

    const deltas = processBatchEnrichment(apolloEnrichments);

    res.json({
      success: true,
      enrichmentsProcessed: apolloEnrichments.length,
      deltasDetected: deltas.length,
      deltas,
    });
  } catch (error) {
    console.error('Error processing Apollo enrichment data:', error);
    res.status(500).json({
      error: 'Failed to process enrichment data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /sync/zoominfo/enrichment
 * Receive enrichment data from ZoomInfo
 */
router.post('/zoominfo/enrichment', async (req: Request, res: Response) => {
  try {
    const { enrichments } = req.body as {
      enrichments: Omit<EnrichmentData, 'source'>[];
    };

    if (!enrichments || !Array.isArray(enrichments)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'enrichments array is required',
      });
    }

    // Add source to each enrichment
    const zoomInfoEnrichments: EnrichmentData[] = enrichments.map((e) => ({
      ...e,
      source: 'zoominfo' as const,
      timestamp: e.timestamp || new Date().toISOString(),
    }));

    const deltas = processBatchEnrichment(zoomInfoEnrichments);

    res.json({
      success: true,
      enrichmentsProcessed: zoomInfoEnrichments.length,
      deltasDetected: deltas.length,
      deltas,
    });
  } catch (error) {
    console.error('Error processing ZoomInfo enrichment data:', error);
    res.status(500).json({
      error: 'Failed to process enrichment data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /sync/enrichment/merged/:entityType/:entityId
 * Get merged enrichment data for an entity
 */
router.get('/enrichment/merged/:entityType/:entityId', (req: Request, res: Response) => {
  const { entityType, entityId } = req.params;
  const { priority } = req.query;

  if (entityType !== 'company' && entityType !== 'contact') {
    return res.status(400).json({
      error: 'Invalid entity type',
      message: 'entityType must be "company" or "contact"',
    });
  }

  const prioritySource = priority === 'apollo' ? 'apollo' : 'zoominfo';
  const merged = mergeEnrichmentData(entityType, entityId, prioritySource);

  res.json({
    entityType,
    entityId,
    prioritySource,
    data: merged,
  });
});

/**
 * GET /sync/scores
 * Get all unified intent scores
 */
router.get('/scores', (_req: Request, res: Response) => {
  const scores = getAllUnifiedScores();
  res.json({
    count: scores.length,
    scores,
  });
});

/**
 * GET /sync/scores/:companyId
 * Get unified intent score for a specific company
 */
router.get('/scores/:companyId', (req: Request, res: Response) => {
  const { companyId } = req.params;
  const score = calculateUnifiedScore(companyId);

  if (!score) {
    return res.status(404).json({
      error: 'Not found',
      message: `No intent data found for company ${companyId}`,
    });
  }

  res.json(score);
});

/**
 * GET /sync/spikes
 * Get all awareness spikes
 */
router.get('/spikes', (_req: Request, res: Response) => {
  const spikes = detectAwarenessSpikes();
  res.json({
    count: spikes.length,
    spikes,
  });
});

export default router;
