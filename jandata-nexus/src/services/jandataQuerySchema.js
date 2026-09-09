/**
 * Controlled JanData Query Schema & Translation Instructions.
 * 
 * The frontend AI MUST act as a query translator, converting natural language questions
 * into controlled, validated JSON queries. Direct SQL construction or execution is strictly prohibited.
 */

export const JANDATA_DOMAINS = [
  'health',
  'agriculture',
  'education',
  'environment',
  'land',
  'transport',
  'welfare',
  'employment',
];

export const SYSTEM_PROMPT_QUERY_TRANSLATOR = `You are the JanData Query Translator AI.
Your job is to translate user natural-language questions about government/public dataset observations and documents into a controlled, structured JSON query format.

STRICT RULES:
1. Do NOT write SQL or code. Output ONLY valid JSON matching the Controlled JanData Query Schema.
2. Output NO conversational text, markdown wrapping (except JSON codeblock), or commentary.
3. Support the following intents:
   - "query": For single indicator queries on a specific entity.
   - "compare_indicators": For comparing multiple indicators on an entity/year.
   - "cross_domain_query": For finding entities matching criteria/conditions across different domain indicators.
   - "semantic_search": For questions about qualitative text, reasons, explanations, or document text chunks.
   - "hybrid": For questions requiring both quantitative structured observations AND qualitative text chunk evidence.

SCHEMA DEFINITION:

Intent 1: "query" (Single indicator search)
{
  "intent": "query",
  "entity": {
    "name": "Dakshina Kannada",
    "type": "district"
  },
  "domain": "agriculture",
  "indicator": "paddy_production",
  "year": 2026
}

Intent 2: "compare_indicators" (Cross-indicator / Join queries)
{
  "intent": "compare_indicators",
  "entity": {
    "name": "Dakshina Kannada",
    "type": "district"
  },
  "year": 2026,
  "indicators": ["paddy_production", "groundwater_level"]
}

Intent 3: "cross_domain_query" (Cross-domain queries with conditions)
{
  "intent": "cross_domain_query",
  "entity_type": "district",
  "year": 2026,
  "conditions": [
    {
      "indicator": "school_enrollment",
      "operator": "<",
      "value": 50000
    },
    {
      "indicator": "unemployment_rate",
      "operator": ">",
      "value": 10
    }
  ]
}

Intent 4: "semantic_search" (Document chunk context search)
{
  "intent": "semantic_search",
  "query": "reasons for expected lower crop coverage"
}

Intent 5: "hybrid" (Both structured observations and document search)
{
  "intent": "hybrid",
  "structured": {
    "intent": "query",
    "entity": { "name": "Dakshina Kannada", "type": "district" },
    "indicator": "rainfall",
    "year": 2026
  },
  "semantic": {
    "intent": "semantic_search",
    "query": "reasons for expected lower crop coverage"
  }
}

Controlled JanData Query Schema also supports optional fields:
- "domain": string (e.g. "health", "agriculture", "education", "environment", "land", "transport", "welfare", "employment")
- "date": string (YYYY-MM-DD)
- "period": string (e.g. "Kharif 2025-26")

Always infer snake_case indicator names (e.g., "paddy_production", "groundwater_level", "school_enrollment", "unemployment_rate", "fully_immunized_children").
`;

/**
 * Validates a controlled JanData JSON query object.
 * Returns { valid: boolean, error?: string, query: object }
 */
export function validateJanDataQuery(queryObj) {
  if (!queryObj || typeof queryObj !== 'object') {
    return { valid: false, error: 'Query must be a non-null object' };
  }

  const validIntents = [
    'query',
    'compare_indicators',
    'cross_indicator_query',
    'cross_domain_query',
    'semantic_search',
    'hybrid',
  ];

  if (!queryObj.intent || !validIntents.includes(queryObj.intent)) {
    return {
      valid: false,
      error: `Invalid or missing intent. Must be one of: ${validIntents.join(', ')}`,
    };
  }

  switch (queryObj.intent) {
    case 'query':
      if (!queryObj.entity || (!queryObj.entity.name && (!queryObj.entity.names || queryObj.entity.names.length === 0))) {
        return { valid: false, error: 'Intent "query" requires entity name(s)' };
      }
      if (!queryObj.indicator && (!queryObj.indicators || queryObj.indicators.length === 0)) {
        return { valid: false, error: 'Intent "query" requires indicator or indicators' };
      }
      break;

    case 'compare_indicators':
    case 'cross_indicator_query':
      if (!queryObj.indicators || !Array.isArray(queryObj.indicators) || queryObj.indicators.length === 0) {
        if (!queryObj.select || !Array.isArray(queryObj.select)) {
          return { valid: false, error: 'Multi-indicator intent requires an array of indicators' };
        }
      }
      break;

    case 'cross_domain_query':
      if (!queryObj.conditions || !Array.isArray(queryObj.conditions) || queryObj.conditions.length === 0) {
        return { valid: false, error: 'Intent "cross_domain_query" requires a conditions array' };
      }
      for (const cond of queryObj.conditions) {
        if (!cond.indicator || !cond.operator || cond.value === undefined) {
          return { valid: false, error: 'Each condition must specify indicator, operator, and value' };
        }
        if (!['<', '>', '=', '<=', '>=', '!='].includes(cond.operator)) {
          return { valid: false, error: `Invalid operator "${cond.operator}" in condition` };
        }
      }
      break;

    case 'semantic_search':
      if (!queryObj.query || typeof queryObj.query !== 'string') {
        return { valid: false, error: 'Intent "semantic_search" requires a query string' };
      }
      break;

    case 'hybrid':
      if (!queryObj.structured || !queryObj.semantic) {
        return { valid: false, error: 'Intent "hybrid" requires both "structured" and "semantic" sub-queries' };
      }
      break;

    default:
      break;
  }

  return { valid: true, query: queryObj };
}
