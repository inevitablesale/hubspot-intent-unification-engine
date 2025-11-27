import {
  ICPMatch,
  ICPCriterion,
  PersonaScore,
  PersonaAttribute,
} from '../models/types';

/**
 * ICP Profile Configuration
 */
export interface ICPProfile {
  name: string;
  criteria: ICPCriterionConfig[];
}

/**
 * ICP Criterion Configuration
 */
export interface ICPCriterionConfig {
  name: string;
  field: string;
  weight: number;
  operator: 'equals' | 'contains' | 'range' | 'in';
  value: unknown;
  minValue?: number;
  maxValue?: number;
}

/**
 * Persona Profile Configuration
 */
export interface PersonaProfile {
  name: string;
  attributes: PersonaAttributeConfig[];
}

/**
 * Persona Attribute Configuration
 */
export interface PersonaAttributeConfig {
  name: string;
  field: string;
  weight: number;
  operator: 'equals' | 'contains' | 'in';
  values: string[];
}

/**
 * Default ICP Profile for B2B SaaS
 */
const defaultICPProfile: ICPProfile = {
  name: 'Default B2B SaaS ICP',
  criteria: [
    {
      name: 'Employee Count',
      field: 'employeeCount',
      weight: 0.25,
      operator: 'range',
      value: null,
      minValue: 50,
      maxValue: 5000,
    },
    {
      name: 'Industry',
      field: 'industry',
      weight: 0.25,
      operator: 'in',
      value: ['Technology', 'Software', 'Financial Services', 'Healthcare'],
    },
    {
      name: 'Revenue',
      field: 'annualRevenue',
      weight: 0.3,
      operator: 'range',
      value: null,
      minValue: 5000000,
      maxValue: 500000000,
    },
    {
      name: 'Has Website',
      field: 'domain',
      weight: 0.1,
      operator: 'contains',
      value: '.',
    },
    {
      name: 'Country',
      field: 'country',
      weight: 0.1,
      operator: 'in',
      value: ['United States', 'Canada', 'United Kingdom', 'Australia'],
    },
  ],
};

/**
 * Default Persona Profiles
 */
const defaultPersonaProfiles: PersonaProfile[] = [
  {
    name: 'Decision Maker',
    attributes: [
      {
        name: 'Title Level',
        field: 'title',
        weight: 0.5,
        operator: 'contains',
        values: ['CEO', 'CTO', 'CFO', 'VP', 'Director', 'Head of'],
      },
      {
        name: 'Department',
        field: 'department',
        weight: 0.3,
        operator: 'in',
        values: ['Executive', 'Sales', 'Marketing', 'Operations'],
      },
      {
        name: 'Seniority',
        field: 'seniority',
        weight: 0.2,
        operator: 'in',
        values: ['C-Level', 'VP', 'Director'],
      },
    ],
  },
  {
    name: 'Technical Evaluator',
    attributes: [
      {
        name: 'Title Level',
        field: 'title',
        weight: 0.4,
        operator: 'contains',
        values: ['Engineer', 'Developer', 'Architect', 'Technical'],
      },
      {
        name: 'Department',
        field: 'department',
        weight: 0.4,
        operator: 'in',
        values: ['Engineering', 'IT', 'Technology', 'Product'],
      },
      {
        name: 'Seniority',
        field: 'seniority',
        weight: 0.2,
        operator: 'in',
        values: ['Senior', 'Lead', 'Principal', 'Staff'],
      },
    ],
  },
  {
    name: 'End User',
    attributes: [
      {
        name: 'Title Level',
        field: 'title',
        weight: 0.3,
        operator: 'contains',
        values: ['Manager', 'Specialist', 'Analyst', 'Coordinator'],
      },
      {
        name: 'Department',
        field: 'department',
        weight: 0.5,
        operator: 'in',
        values: ['Sales', 'Marketing', 'Customer Success', 'Support'],
      },
      {
        name: 'Seniority',
        field: 'seniority',
        weight: 0.2,
        operator: 'in',
        values: ['Manager', 'Individual Contributor'],
      },
    ],
  },
];

/**
 * Calculate ICP match score for a company
 */
export function calculateICPMatch(
  companyData: Record<string, unknown>,
  profile: ICPProfile = defaultICPProfile
): ICPMatch {
  const companyId = (companyData.id as string) || 'unknown';
  const matchedCriteria: ICPCriterion[] = [];
  const unmatchedCriteria: ICPCriterion[] = [];
  let totalWeight = 0;
  let matchedWeight = 0;

  for (const criterion of profile.criteria) {
    const fieldValue = companyData[criterion.field];
    const matched = evaluateCriterion(fieldValue, criterion);
    totalWeight += criterion.weight;

    const criterionResult: ICPCriterion = {
      name: criterion.name,
      weight: criterion.weight,
      matched,
      actualValue: fieldValue as string | number | undefined,
      expectedValue: criterion.value as string | number | undefined,
    };

    if (matched) {
      matchedWeight += criterion.weight;
      matchedCriteria.push(criterionResult);
    } else {
      unmatchedCriteria.push(criterionResult);
    }
  }

  const matchScore = totalWeight > 0 
    ? Math.round((matchedWeight / totalWeight) * 100) 
    : 0;
  const tier = determineTier(matchScore);

  return {
    companyId,
    hubspotCompanyId: companyData.hubspotId as string | undefined,
    matchScore,
    matchedCriteria,
    unmatchedCriteria,
    tier,
  };
}

/**
 * Evaluate a single criterion against a value
 */
function evaluateCriterion(
  value: unknown,
  criterion: ICPCriterionConfig
): boolean {
  if (value === undefined || value === null) return false;

  switch (criterion.operator) {
    case 'equals':
      return value === criterion.value;

    case 'contains':
      if (typeof value === 'string' && typeof criterion.value === 'string') {
        return value.toLowerCase().includes(criterion.value.toLowerCase());
      }
      return false;

    case 'range':
      if (typeof value === 'number') {
        const min = criterion.minValue ?? Number.MIN_SAFE_INTEGER;
        const max = criterion.maxValue ?? Number.MAX_SAFE_INTEGER;
        return value >= min && value <= max;
      }
      return false;

    case 'in':
      if (Array.isArray(criterion.value)) {
        return criterion.value.some((v) => {
          if (typeof v === 'string' && typeof value === 'string') {
            return value.toLowerCase() === v.toLowerCase();
          }
          return value === v;
        });
      }
      return false;

    default:
      return false;
  }
}

/**
 * Determine the tier based on match score
 */
function determineTier(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

/**
 * Calculate persona score for a contact
 */
export function calculatePersonaScore(
  contactData: Record<string, unknown>,
  profiles: PersonaProfile[] = defaultPersonaProfiles
): PersonaScore {
  const contactId = (contactData.id as string) || 'unknown';
  const email = (contactData.email as string) || '';

  let bestMatch: {
    profile: PersonaProfile;
    score: number;
    attributes: PersonaAttribute[];
  } | null = null;

  for (const profile of profiles) {
    const { score, attributes } = evaluatePersonaProfile(contactData, profile);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { profile, score, attributes };
    }
  }

  if (!bestMatch) {
    return {
      contactId,
      hubspotContactId: contactData.hubspotId as string | undefined,
      email,
      personaType: 'Unknown',
      matchScore: 0,
      attributes: [],
    };
  }

  return {
    contactId,
    hubspotContactId: contactData.hubspotId as string | undefined,
    email,
    personaType: bestMatch.profile.name,
    matchScore: bestMatch.score,
    attributes: bestMatch.attributes,
  };
}

/**
 * Evaluate a contact against a persona profile
 */
function evaluatePersonaProfile(
  contactData: Record<string, unknown>,
  profile: PersonaProfile
): { score: number; attributes: PersonaAttribute[] } {
  const attributes: PersonaAttribute[] = [];
  let totalWeight = 0;
  let matchedWeight = 0;

  for (const attr of profile.attributes) {
    const fieldValue = contactData[attr.field];
    const matched = evaluatePersonaAttribute(fieldValue, attr);
    totalWeight += attr.weight;

    attributes.push({
      name: attr.name,
      value: (fieldValue as string) || '',
      weight: attr.weight,
      matched,
    });

    if (matched) {
      matchedWeight += attr.weight;
    }
  }

  const score = totalWeight > 0 
    ? Math.round((matchedWeight / totalWeight) * 100) 
    : 0;

  return { score, attributes };
}

/**
 * Evaluate a persona attribute
 */
function evaluatePersonaAttribute(
  value: unknown,
  attr: PersonaAttributeConfig
): boolean {
  if (value === undefined || value === null || typeof value !== 'string') {
    return false;
  }

  const lowerValue = value.toLowerCase();

  switch (attr.operator) {
    case 'equals':
      return attr.values.some((v) => lowerValue === v.toLowerCase());

    case 'contains':
      return attr.values.some((v) => lowerValue.includes(v.toLowerCase()));

    case 'in':
      return attr.values.some((v) => lowerValue === v.toLowerCase());

    default:
      return false;
  }
}

/**
 * Get all persona profiles
 */
export function getPersonaProfiles(): PersonaProfile[] {
  return defaultPersonaProfiles;
}

/**
 * Get the default ICP profile
 */
export function getICPProfile(): ICPProfile {
  return defaultICPProfile;
}
