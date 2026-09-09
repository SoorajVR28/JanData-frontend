import { parseNaturalLanguageToQuery, synthesizeFinalAnswer } from './groqService.js';
import { executeJanDataQuery } from './supabaseQueryEngine.js';

/**
 * Executes the complete JanData Nexus Query & Retrieval Pipeline:
 * User question → Groq Query Parser → Controlled JSON Query → Supabase Query Engine (RLS) → Structured Results + Provenance → Groq Synthesizer → Final Answer
 * 
 * @param {string} userQuestion - The natural-language question asked by the user.
 * @returns {Promise<{
 *   success: boolean,
 *   userQuestion: string,
 *   controlledQuery: object | null,
 *   dbResults: object | null,
 *   answer: string,
 *   executionTimeMs: number,
 *   error?: string
 * }>}
 */
export async function runJanDataPipeline(userQuestion) {
  const startTime = Date.now();

  try {
    // Step 1: Natural-language → Controlled JanData Query JSON
    const parseResult = await parseNaturalLanguageToQuery(userQuestion);

    if (!parseResult.valid || !parseResult.query) {
      return {
        success: false,
        userQuestion,
        controlledQuery: parseResult.query || null,
        dbResults: null,
        answer: `Could not parse question into a valid query: ${parseResult.error || 'Unknown parsing error'}`,
        executionTimeMs: Date.now() - startTime,
        error: parseResult.error,
      };
    }

    const controlledQuery = parseResult.query;

    // Step 2: Controlled JSON Query → Supabase Direct Database Retrieval (RLS)
    const dbResults = await executeJanDataQuery(controlledQuery);

    if (!dbResults.success) {
      return {
        success: false,
        userQuestion,
        controlledQuery,
        dbResults: dbResults,
        answer: `Database query execution failed: ${dbResults.error}`,
        executionTimeMs: Date.now() - startTime,
        error: dbResults.error,
      };
    }

    // Step 3: Structured Results + Document Provenance → Groq Natural-Language Synthesis
    const answerText = await synthesizeFinalAnswer(userQuestion, controlledQuery, dbResults);

    return {
      success: true,
      userQuestion,
      controlledQuery,
      dbResults: dbResults,
      answer: answerText,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    console.error('[JanData Pipeline Error]:', err);
    return {
      success: false,
      userQuestion,
      controlledQuery: null,
      dbResults: null,
      answer: `Pipeline execution encountered an unexpected error: ${err.message}`,
      executionTimeMs: Date.now() - startTime,
      error: err.message,
    };
  }
}
