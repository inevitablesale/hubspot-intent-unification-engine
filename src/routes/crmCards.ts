import { Router, Request, Response } from 'express';
import { CRMCardResponse, CRMCardProperty } from '../models/types';
import { calculateUnifiedScore, getSignalsForCompany } from '../services/scoringEngine';
import { calculateICPMatch, calculatePersonaScore } from '../services/icpPersonaScoring';
import { mergeEnrichmentData } from '../services/enrichmentSync';

const router = Router();

/**
 * GET /crm-cards/intent-trends
 * CRM Card endpoint for displaying intent trends on company records
 */
router.get('/intent-trends', (req: Request, res: Response) => {
  try {
    const { associatedObjectId, associatedObjectType } = req.query;

    if (!associatedObjectId || associatedObjectType !== 'COMPANY') {
      return res.json({
        results: [],
      } as CRMCardResponse);
    }

    // In production, you would look up the company by HubSpot ID
    // For this implementation, we'll use the objectId as a fallback
    const companyId = associatedObjectId as string;
    const score = calculateUnifiedScore(companyId);
    const signals = getSignalsForCompany(companyId);

    if (!score) {
      return res.json({
        results: [
          {
            objectId: parseInt(associatedObjectId as string, 10) || 1,
            title: 'Intent Score',
            properties: [
              {
                label: 'Status',
                dataType: 'STRING',
                value: 'No intent data available',
              },
            ],
          },
        ],
      } as CRMCardResponse);
    }

    const properties: CRMCardProperty[] = [
      {
        label: 'Overall Score',
        dataType: 'NUMBER',
        value: score.overallScore,
      },
      {
        label: 'Apollo Score',
        dataType: 'NUMBER',
        value: score.apolloScore,
      },
      {
        label: 'ZoomInfo Score',
        dataType: 'NUMBER',
        value: score.zoomInfoScore,
      },
      {
        label: 'Trend',
        dataType: 'STATUS',
        value: score.trend === 'increasing' ? '📈 Increasing' : 
               score.trend === 'decreasing' ? '📉 Decreasing' : 
               '➡️ Stable',
      },
      {
        label: 'Signal Count',
        dataType: 'NUMBER',
        value: score.signalCount,
      },
      {
        label: 'Top Topics',
        dataType: 'STRING',
        value: score.topTopics.map((t) => t.topic).join(', ') || 'None',
      },
      {
        label: 'Last Updated',
        dataType: 'DATE',
        value: score.lastUpdated,
      },
    ];

    if (score.isSpike) {
      properties.unshift({
        label: '🚨 Alert',
        dataType: 'STRING',
        value: 'Intent spike detected!',
      });
    }

    const response: CRMCardResponse = {
      results: [
        {
          objectId: parseInt(associatedObjectId as string, 10) || 1,
          title: 'Intent Score',
          properties,
          actions: [
            {
              type: 'EXTERNAL_URL',
              uri: `https://app.example.com/intent/${companyId}`,
              label: 'View Details',
            },
          ],
        },
      ],
    };

    // Add recent signals section if available
    if (signals.length > 0) {
      const recentSignals = signals.slice(-5).reverse();
      response.results.push({
        objectId: (parseInt(associatedObjectId as string, 10) || 1) + 1,
        title: 'Recent Signals',
        properties: recentSignals.map((signal) => ({
          label: `${signal.source.toUpperCase()} - ${signal.topic}`,
          dataType: 'STRING' as const,
          value: `Score: ${signal.signalStrength} (${new Date(signal.timestamp).toLocaleDateString()})`,
        })),
      });
    }

    res.json(response);
  } catch (error) {
    console.error('Error generating CRM card data:', error);
    res.status(500).json({
      error: 'Failed to generate CRM card data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /crm-cards/icp-match
 * CRM Card endpoint for displaying ICP match on company records
 */
router.get('/icp-match', (req: Request, res: Response) => {
  try {
    const { associatedObjectId, associatedObjectType } = req.query;

    if (!associatedObjectId || associatedObjectType !== 'COMPANY') {
      return res.json({
        results: [],
      } as CRMCardResponse);
    }

    const companyId = associatedObjectId as string;
    
    // Get merged enrichment data for ICP calculation
    const enrichedData = mergeEnrichmentData('company', companyId);
    
    if (Object.keys(enrichedData).length === 0) {
      return res.json({
        results: [
          {
            objectId: parseInt(associatedObjectId as string, 10) || 1,
            title: 'ICP Match',
            properties: [
              {
                label: 'Status',
                dataType: 'STRING',
                value: 'No enrichment data available',
              },
            ],
          },
        ],
      } as CRMCardResponse);
    }

    const icpMatch = calculateICPMatch({ id: companyId, ...enrichedData });

    const tierColors: Record<string, string> = {
      'A': '🟢',
      'B': '🟡',
      'C': '🟠',
      'D': '🔴',
    };

    const properties: CRMCardProperty[] = [
      {
        label: 'ICP Tier',
        dataType: 'STATUS',
        value: `${tierColors[icpMatch.tier]} Tier ${icpMatch.tier}`,
      },
      {
        label: 'Match Score',
        dataType: 'NUMBER',
        value: icpMatch.matchScore,
      },
      {
        label: 'Criteria Matched',
        dataType: 'STRING',
        value: `${icpMatch.matchedCriteria.length}/${icpMatch.matchedCriteria.length + icpMatch.unmatchedCriteria.length}`,
      },
    ];

    // Add matched criteria
    for (const criterion of icpMatch.matchedCriteria.slice(0, 3)) {
      properties.push({
        label: `✅ ${criterion.name}`,
        dataType: 'STRING',
        value: String(criterion.actualValue || 'Yes'),
      });
    }

    // Add unmatched criteria
    for (const criterion of icpMatch.unmatchedCriteria.slice(0, 2)) {
      properties.push({
        label: `❌ ${criterion.name}`,
        dataType: 'STRING',
        value: String(criterion.actualValue || 'Missing'),
      });
    }

    const response: CRMCardResponse = {
      results: [
        {
          objectId: parseInt(associatedObjectId as string, 10) || 1,
          title: 'ICP Match',
          properties,
        },
      ],
    };

    res.json(response);
  } catch (error) {
    console.error('Error generating ICP CRM card data:', error);
    res.status(500).json({
      error: 'Failed to generate ICP CRM card data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /crm-cards/persona
 * CRM Card endpoint for displaying persona match on contact records
 */
router.get('/persona', (req: Request, res: Response) => {
  try {
    const { associatedObjectId, associatedObjectType } = req.query;

    if (!associatedObjectId || associatedObjectType !== 'CONTACT') {
      return res.json({
        results: [],
      } as CRMCardResponse);
    }

    const contactId = associatedObjectId as string;
    
    // Get merged enrichment data for persona calculation
    const enrichedData = mergeEnrichmentData('contact', contactId);
    
    if (Object.keys(enrichedData).length === 0) {
      return res.json({
        results: [
          {
            objectId: parseInt(associatedObjectId as string, 10) || 1,
            title: 'Persona Match',
            properties: [
              {
                label: 'Status',
                dataType: 'STRING',
                value: 'No enrichment data available',
              },
            ],
          },
        ],
      } as CRMCardResponse);
    }

    const personaScore = calculatePersonaScore({ id: contactId, ...enrichedData });

    const properties: CRMCardProperty[] = [
      {
        label: 'Persona Type',
        dataType: 'STATUS',
        value: personaScore.personaType,
      },
      {
        label: 'Match Score',
        dataType: 'NUMBER',
        value: personaScore.matchScore,
      },
    ];

    // Add attribute matches
    for (const attr of personaScore.attributes) {
      properties.push({
        label: `${attr.matched ? '✅' : '❌'} ${attr.name}`,
        dataType: 'STRING',
        value: attr.value || 'Unknown',
      });
    }

    const response: CRMCardResponse = {
      results: [
        {
          objectId: parseInt(associatedObjectId as string, 10) || 1,
          title: 'Persona Match',
          properties,
        },
      ],
    };

    res.json(response);
  } catch (error) {
    console.error('Error generating Persona CRM card data:', error);
    res.status(500).json({
      error: 'Failed to generate Persona CRM card data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
