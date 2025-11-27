import { Router, Request, Response } from 'express';
import { calculateICPMatch, calculatePersonaScore } from '../services/icpPersonaScoring';

const router = Router();

/**
 * POST /scoring/icp
 * Calculate ICP match score for a company
 */
router.post('/icp', (req: Request, res: Response) => {
  try {
    const { companyData } = req.body as {
      companyData: Record<string, unknown>;
    };

    if (!companyData || typeof companyData !== 'object') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'companyData object is required',
      });
    }

    const icpMatch = calculateICPMatch(companyData);

    res.json({
      success: true,
      result: icpMatch,
    });
  } catch (error) {
    console.error('Error calculating ICP match:', error);
    res.status(500).json({
      error: 'Failed to calculate ICP match',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /scoring/icp/batch
 * Calculate ICP match scores for multiple companies
 */
router.post('/icp/batch', (req: Request, res: Response) => {
  try {
    const { companies } = req.body as {
      companies: Record<string, unknown>[];
    };

    if (!companies || !Array.isArray(companies)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'companies array is required',
      });
    }

    const results = companies.map((companyData) => calculateICPMatch(companyData));

    res.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('Error calculating ICP matches:', error);
    res.status(500).json({
      error: 'Failed to calculate ICP matches',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /scoring/persona
 * Calculate persona score for a contact
 */
router.post('/persona', (req: Request, res: Response) => {
  try {
    const { contactData } = req.body as {
      contactData: Record<string, unknown>;
    };

    if (!contactData || typeof contactData !== 'object') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'contactData object is required',
      });
    }

    const personaScore = calculatePersonaScore(contactData);

    res.json({
      success: true,
      result: personaScore,
    });
  } catch (error) {
    console.error('Error calculating persona score:', error);
    res.status(500).json({
      error: 'Failed to calculate persona score',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /scoring/persona/batch
 * Calculate persona scores for multiple contacts
 */
router.post('/persona/batch', (req: Request, res: Response) => {
  try {
    const { contacts } = req.body as {
      contacts: Record<string, unknown>[];
    };

    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'contacts array is required',
      });
    }

    const results = contacts.map((contactData) => calculatePersonaScore(contactData));

    res.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('Error calculating persona scores:', error);
    res.status(500).json({
      error: 'Failed to calculate persona scores',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
