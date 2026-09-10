import { validateJanDataQuery } from './jandataQuerySchema.js';

/**
 * Send a controlled query to the JanData backend contract.
 * The browser never queries Supabase tables or constructs SQL.
 *
 * @param {object} rawQuery - Query produced by the frontend AI translator.
 * @returns {Promise<object>} Structured observations and/or document evidence.
 */
export async function executeJanDataQuery(rawQuery) {
  const validation = validateJanDataQuery(rawQuery);

  if (!validation.valid) {
    return {
      success: false,
      intent: rawQuery?.intent || 'unknown',
      error: `Query validation failed: ${validation.error}`,
      data: null,
    };
  }

  const query = validation.query;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const endpoint = import.meta.env.VITE_JANDATA_QUERY_URL
    || (supabaseUrl ? `${supabaseUrl}/functions/v1/jandata-query` : '/query');
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const headers = { 'Content-Type': 'application/json' };

  if (anonKey) {
    headers.apikey = anonKey;
    headers.Authorization = `Bearer ${anonKey}`;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(query),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        intent: query.intent,
        error: result?.error || `JanData backend returned status ${response.status}`,
        data: null,
      };
    }

    return {
      success: result?.success !== false,
      intent: query.intent,
      ...result,
    };
  } catch (err) {
    console.error('[JanData Backend Query Error]:', err);
    return {
      success: false,
      intent: query.intent,
      error: err.message || 'Unable to reach the JanData backend',
      data: null,
    };
  }
}
