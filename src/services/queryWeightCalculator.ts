/**
 * Query Weight Calculator
 * Determines the weight/cost of a query based on its characteristics
 * Used to dynamically price different types of queries
 */
import { OpenAIClient } from '../openAIClient/openaiClient';

export interface QueryWeightAnalysis {
  weight: number;
  category: 'library_related' | 'other' | 'complex';
  reason: string;
}

/**
 * Library-related keywords that indicate lower-weight queries
 */
const LIBRARY_KEYWORDS = [
  'book',
  'entry',
  'title',
  'author',
  'category',
  'published',
  'language',
  'summary',
  'catalog',
  'readium',
  'literature',
  'library',
  'search',
  'find',
  'list',
  'filter',
  'query entries',
  'get entries',
  'display books',
];

/**
 * Complex operation indicators that suggest higher-weight queries
 */
const COMPLEX_KEYWORDS = [
  'analysis',
  'synthesis',
  'summarize',
  'compare',
  'contrast',
  'explain',
  'calculate',
  'solve',
  'optimize',
  'design',
  'create',
  'generate',
  'write',
  'compose',
  'translate',
];

/**
 * Analyze query to determine its weight
 * Returns weight multiplier: 1.0 (library search) to 3.0+ (complex analysis)
 */
export async function calculateQueryWeight(query: string): Promise<number> {
  const analysis = await analyzeQueryComplexity(query);
  return analysis.weight;
}

/**
 * Detailed analysis of query complexity
 */
export async function analyzeQueryComplexity(query: string): Promise<QueryWeightAnalysis> {
  const lowerQuery = query.toLowerCase();

  // Count keyword occurrences
  let libraryScore = 0;
  let complexScore = 0;

  for (const keyword of LIBRARY_KEYWORDS) {
    if (lowerQuery.includes(keyword)) {
      libraryScore++;
    }
  }

  for (const keyword of COMPLEX_KEYWORDS) {
    if (lowerQuery.includes(keyword)) {
      complexScore++;
    }
  }

  // Calculate base weight
  let weight = 1.0;
  let category: 'library_related' | 'other' | 'complex' = 'other';
  let reason = 'Standard query';

  if (libraryScore > complexScore) {
    // This is a library search/catalog query
    weight = 1.0;
    category = 'library_related';
    reason = `Library-related query (${libraryScore} indicators)`;
  } else if (complexScore > libraryScore && complexScore > 0) {
    // This is a complex operation
    weight = Math.min(3.0, 1.5 + complexScore * 0.3);
    category = 'complex';
    reason = `Complex operation (${complexScore} indicators, weight: ${weight.toFixed(2)}x)`;
  } else if (query.length > 500) {
    // Very long queries are more resource-intensive
    weight = 1.5;
    category = 'other';
    reason = `Extended query (length: ${query.length} chars)`;
  }

  return {
    weight,
    category,
    reason,
  };
}

/**
 * Get weight for a specific message type
 * Used by the AI to determine pricing for different operations
 */
export function getWeightForMessageType(type: 'user_message' | 'function_call' | 'tool_use' | 'response'): number {
  switch (type) {
    case 'user_message':
      return 1.0;
    case 'function_call':
      return 0.5; // Function calls to tools have lower weight
    case 'tool_use':
      return 1.5; // Tool execution has higher weight
    case 'response':
      return 1.0; // Response generation
    default:
      return 1.0;
  }
}

/**
 * Format weight analysis for display
 */
export function formatWeightAnalysis(analysis: QueryWeightAnalysis): string {
  return `Weight: ${analysis.weight.toFixed(2)}x | Category: ${analysis.category} | Reason: ${analysis.reason}`;
}
