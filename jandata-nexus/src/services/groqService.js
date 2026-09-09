import { SYSTEM_PROMPT_QUERY_TRANSLATOR, validateJanDataQuery } from './jandataQuerySchema.js';

// Serverless Function endpoint URL for Groq API
const GROQ_SERVERLESS_ENDPOINT = import.meta.env.VITE_GROQ_SERVERLESS_URL || '/api/groq';

/**
 * Sends a request to the Groq Serverless Function endpoint.
 * 
 * @param {Array<{ role: string, content: string }>} messages - Conversation history/messages.
 * @param {object} [options] - Temperature, model, response_format options.
 */
export async function callGroqServerless(messages, options = {}) {
  const payload = {
    messages,
    model: options.model || 'llama-3.3-70b-versatile',
    temperature: options.temperature ?? 0.1,
    response_format: options.response_format,
  };

  const response = await fetch(GROQ_SERVERLESS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errMessage = `Groq Serverless Function returned status ${response.status}`;
    try {
      const errData = await response.json();
      if (errData.error) errMessage += `: ${errData.error}`;
    } catch (_) {}
    throw new Error(errMessage);
  }

  const result = await response.json();
  return result.content || result.choices?.[0]?.message?.content || '';
}

/**
 * Step 1: Translates user natural-language question into a Controlled JanData Query JSON.
 * 
 * @param {string} userQuestion - The question asked by the user.
 * @returns {Promise<{ valid: boolean, query: object, error?: string }>}
 */
export async function parseNaturalLanguageToQuery(userQuestion) {
  try {
    const rawAiResponse = await callGroqServerless(
      [
        { role: 'system', content: SYSTEM_PROMPT_QUERY_TRANSLATOR },
        { role: 'user', content: userQuestion },
      ],
      { temperature: 0.0, response_format: { type: 'json_object' } }
    );

    // Clean JSON markdown wrappers if present
    let cleanedText = rawAiResponse.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const queryObj = JSON.parse(cleanedText);
    const validation = validateJanDataQuery(queryObj);

    if (!validation.valid) {
      return { valid: false, query: queryObj, error: validation.error };
    }

    return { valid: true, query: validation.query };
  } catch (err) {
    console.error('[Groq Query Parser Error]:', err);
    return { valid: false, query: null, error: err.message };
  }
}

/**
 * Step 2: Synthesizes final natural-language response using query results and provenance metadata.
 * 
 * @param {string} userQuestion - Original user question.
 * @param {object} controlledQuery - Executed controlled JanData JSON query.
 * @param {object} queryResults - Structured results and provenance retrieved from Supabase.
 * @returns {Promise<string>} Natural language response text.
 */
export async function synthesizeFinalAnswer(userQuestion, controlledQuery, queryResults) {
  const synthesisSystemPrompt = `You are JanData Nexus AI Assistant, providing answers based ONLY on verified government/public data observations and documents.

CRITICAL INSTRUCTIONS:
1. Always state the values along with their EXACT units (e.g. "%", "lakh tonnes", "metres").
2. ALWAYS cite the source provenance whenever available (e.g. source document name/URL, page number, confidence score).
3. If data is missing or empty, state clearly that no observation was found matching the criteria.
4. Keep answers professional, accurate, concise, and structured.
5. Do NOT hallucinate data or numbers not present in the provided evidence JSON.`;

  const userContext = `User Question: "${userQuestion}"

Executed Controlled Query:
${JSON.stringify(controlledQuery, null, 2)}

Retrieved Data & Provenance Evidence:
${JSON.stringify(queryResults, null, 2)}

Generate the final natural-language response with proper provenance citation.`;

  try {
    const answer = await callGroqServerless([
      { role: 'system', content: synthesisSystemPrompt },
      { role: 'user', content: userContext },
    ], { temperature: 0.2 });

    return answer;
  } catch (err) {
    console.error('[Groq Answer Synthesis Error]:', err);
    return `Error generating natural-language response: ${err.message}`;
  }
}
