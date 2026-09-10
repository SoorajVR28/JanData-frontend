// Supabase Edge Function: jandata-query
// @ts-ignore: The regular VS Code TypeScript service cannot resolve Deno URLs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore: The regular VS Code TypeScript service cannot resolve Deno URLs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

type Query = Record<string, any>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function validateQuery(query: Query) {
  const intents = [
    "query",
    "compare_indicators",
    "cross_indicator_query",
    "cross_domain_query",
    "semantic_search",
    "hybrid",
  ];

  if (!query || typeof query !== "object" || !intents.includes(query.intent)) {
    return "Invalid or missing query intent";
  }

  if (query.intent === "semantic_search" && typeof query.query !== "string") {
    return "semantic_search requires a query string";
  }

  if (query.intent === "hybrid" && (!query.structured || !query.semantic)) {
    return "hybrid requires structured and semantic queries";
  }

  if (query.intent === "cross_domain_query" &&
    (!Array.isArray(query.conditions) || query.conditions.length === 0)) {
    return "cross_domain_query requires conditions";
  }

  if (["compare_indicators", "cross_indicator_query"].includes(query.intent) &&
    !getIndicators(query).length) {
    return "comparison queries require indicators";
  }

  return null;
}

function getIndicators(query: Query) {
  const indicators = query.indicators ?? query.select ?? [];
  return Array.isArray(indicators) ? indicators : [];
}

const indicatorAliases: Record<string, string[]> = {
  rainfall: [
    "cumulative_rainfall_7d_actual",
    "cumulative_rainfall_july_est",
    "cumulative_rainfall_tune_est",
  ],
};

function indicatorKey(value: string) {
  return value.toLowerCase()
    .replace(/seven\s*day|7\s*day|7d/g, "7d")
    .replace(/estimated/g, "est")
    .replace(/[^a-z0-9]/g, "");
}

function indicatorScore(requested: string, candidate: string) {
  const wanted = indicatorKey(requested);
  const actual = indicatorKey(candidate);
  if (wanted === actual) return 100;
  if (actual.includes(wanted) || wanted.includes(actual)) return 70;

  const wantedWords = requested.toLowerCase().split(/[_\s-]+/).filter(Boolean);
  const actualWords = candidate.toLowerCase().split(/[_\s-]+/).filter(Boolean);
  const overlap = wantedWords.filter((word: string) => actualWords.includes(word)).length;
  return overlap ? (overlap / wantedWords.length) * 50 : 0;
}

// ---------------------------------------------------------------------------
// NEW: Groq-backed semantic re-rank, added to fix indicator mismatches that
// pure lexical scoring can't catch (true synonyms with no shared words, e.g.
// "vaccinated" vs "immunized"). Reuses the existing `groq-chat` edge function
// rather than calling Groq's API directly, so the API key stays in one place.
// ---------------------------------------------------------------------------

/** Lexical scores >= this are treated as confident enough to skip the extra Groq call. */
const AUTO_ACCEPT_SCORE = 90;
/** How many lexical candidates get shown to Groq for the semantic re-rank. */
const RERANK_TOP_N = 5;
/** Literal string Groq must return when none of the candidates confidently match. */
const NO_MATCH_TOKEN = "NONE";

async function callGroqRerank(userText: string, candidates: string[]): Promise<string> {
  if (candidates.length === 0) return NO_MATCH_TOKEN;

  const candidateList = candidates.map((c) => `- ${c}`).join("\n");

  const systemPrompt =
    `You are matching a user's request to the correct database field value.\n` +
    `You will be given the user's requested indicator and a list of candidate ` +
    `values that actually exist in the database.\n\n` +
    `Rules:\n` +
    `1. Respond with EXACTLY one of the candidate strings, copied character-for-character, ` +
    `if one of them means the same thing as the request.\n` +
    `2. Pay close attention to words that reverse meaning (e.g. "fully" vs "partially", ` +
    `"increase" vs "decrease") - do not pick a candidate that is only superficially similar.\n` +
    `3. If none of the candidates confidently match, respond with exactly: ${NO_MATCH_TOKEN}\n` +
    `4. Do not explain your answer. Do not add punctuation. Output only the matched string or ${NO_MATCH_TOKEN}.`;

  const userPrompt =
    `Requested indicator: "${userText}"\n\n` +
    `Candidate values:\n${candidateList}\n\n` +
    `Which candidate (verbatim) matches? If none do, respond ${NO_MATCH_TOKEN}.`;

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/groq-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        model: "groq/compound",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      // Fail safe: if the rerank call itself fails, treat as unresolved
      // rather than guessing or crashing the whole query.
      return NO_MATCH_TOKEN;
    }

    const data = await response.json();
    return (data?.content ?? "").trim();
  } catch {
    return NO_MATCH_TOKEN;
  }
}

interface IndicatorResolution {
  requested: string;
  /** Verified, real observations.indicator value(s) to actually query. Empty if unresolved. */
  indicators: string[];
  status: "alias" | "exact" | "ai_resolved" | "unresolved";
  /** Top lexical candidates considered, kept for clarification responses / logging. */
  candidates: { indicator: string; score: number }[];
}

async function resolveIndicator(indicator: string, query: Query): Promise<IndicatorResolution> {
  if (indicatorAliases[indicator]) {
    return { requested: indicator, indicators: indicatorAliases[indicator], status: "alias", candidates: [] };
  }

  let builder = supabase.from("observations").select("indicator");
  builder = applyCommonFilters(builder, { ...query, domain: undefined });
  const { data, error } = await builder.limit(1000);

  if (error || !data?.length) {
    return { requested: indicator, indicators: [], status: "unresolved", candidates: [] };
  }

  const candidatePool = [...new Set(data.map((row: Query) => row.indicator).filter(Boolean))] as string[];
  const scored = candidatePool
    .map((candidate) => ({ indicator: candidate, score: indicatorScore(indicator, candidate) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  // High-confidence lexical/exact match - no need to spend an extra Groq call.
  if (best && best.score >= AUTO_ACCEPT_SCORE) {
    return {
      requested: indicator,
      indicators: [best.indicator],
      status: "exact",
      candidates: scored.slice(0, RERANK_TOP_N),
    };
  }

  // Not confident lexically. This is exactly the case that used to fail
  // silently (e.g. true synonyms scoring 0) - ask Groq to judge meaning over
  // the top real candidates instead of falling back to the raw guess.
  const topCandidates = scored.slice(0, RERANK_TOP_N).map((c) => c.indicator);

  // NOTE: adjust this to whatever field your Query object actually carries
  // the user's original natural-language question in, if any (e.g.
  // query.raw_question, query.user_query, query.text). Falls back to the
  // indicator phrase itself if no such field exists.
  const userText = query.raw_question ?? query.user_query ?? query.text ?? indicator;

  const rerankRaw = await callGroqRerank(userText, topCandidates);
  const trimmedRerank = rerankRaw.trim();
  const matched = topCandidates.find((c) => c === trimmedRerank || trimmedRerank.endsWith(c) || trimmedRerank.includes(c));

  if (matched) {
    return {
      requested: indicator,
      indicators: [matched],
      status: "ai_resolved",
      candidates: scored.slice(0, RERANK_TOP_N),
    };
  }

  return {
    requested: indicator,
    indicators: [],
    status: "unresolved",
    candidates: scored.slice(0, RERANK_TOP_N),
  };
}

function applyCommonFilters(builder: any, query: Query) {
  const entity = query.entity ?? {};
  const year = query.year ?? query.time?.year;

  if (entity.name) builder = builder.eq("entity_name", entity.name);
  if (Array.isArray(entity.names) && entity.names.length) {
    builder = builder.in("entity_name", entity.names);
  }
  if (entity.type ?? query.entity_type) {
    builder = builder.eq("entity_type", entity.type ?? query.entity_type);
  }
  if (query.domain) builder = builder.eq("domain", query.domain);
  if (year !== undefined) builder = builder.eq("year", year);
  if (query.date) builder = builder.eq("date", query.date);
  if (query.period) builder = builder.eq("period", query.period);

  return builder;
}

async function structuredQuery(query: Query): Promise<any> {
  const requestedIndicators = query.indicator
    ? [query.indicator]
    : getIndicators(query);

  const resolutions = await Promise.all(
    requestedIndicators.map((indicator: string) => resolveIndicator(indicator, query)),
  );

  const resolvedIndicators = resolutions.flatMap((r) => r.indicators);
  const unresolved = resolutions.filter((r) => r.status === "unresolved");

  // Nothing resolved at all - return a clarification payload instead of
  // silently running an empty query or querying with an invented string.
  if (requestedIndicators.length > 0 && resolvedIndicators.length === 0) {
    return {
      success: true,
      intent: query.intent,
      count: 0,
      data: [],
      clarification_needed: true,
      unresolved_indicators: unresolved.map((r) => ({
        requested: r.requested,
        suggestions: r.candidates.map((c) => c.indicator),
      })),
    };
  }

  const run = async (includeDomain: boolean) => {
    let builder = supabase.from("observations").select("*");
    builder = applyCommonFilters(builder, includeDomain ? query : { ...query, domain: undefined });

    if (resolvedIndicators.length) builder = builder.in("indicator", resolvedIndicators);

    return builder;
  };

  let { data, error } = await run(true);
  if (!error && (!data || data.length === 0) && query.domain) {
    ({ data, error } = await run(false));
  }
  if (error) throw error;

  return {
    success: true,
    intent: query.intent,
    count: data?.length ?? 0,
    data: data ?? [],
    ...(unresolved.length > 0
      ? {
        partially_unresolved: true,
        unresolved_indicators: unresolved.map((r) => ({
          requested: r.requested,
          suggestions: r.candidates.map((c) => c.indicator),
        })),
      }
      : {}),
  };
}

async function compareQuery(query: Query): Promise<any> {
  const result: any = await structuredQuery(query);
  if (result.clarification_needed) return result;

  const entity = query.entity?.name ?? "Multiple";
  const year = query.year ?? query.time?.year ?? "All Available";
  const data: Record<string, any> = {};

  for (const observation of result.data) {
    data[observation.indicator] = {
      value: observation.value,
      unit: observation.unit,
      source: observation.source_document,
      source_page: observation.source_page,
      domain: observation.domain,
      confidence: observation.confidence,
      provenance: observation.provenance ?? null,
    };
  }

  return {
    success: true,
    intent: query.intent,
    data: {
      entity,
      entity_type: query.entity?.type ?? query.entity_type ?? null,
      year,
      data,
    },
    raw_count: result.data.length,
    ...(result.partially_unresolved
      ? { partially_unresolved: true, unresolved_indicators: result.unresolved_indicators }
      : {}),
  };
}

function matches(value: any, operator: string, target: any) {
  switch (operator) {
    case "<": return value < target;
    case ">": return value > target;
    case "=":
    case "==": return value === target;
    case "<=": return value <= target;
    case ">=": return value >= target;
    case "!=": return value !== target;
    default: return false;
  }
}

async function crossDomainQuery(query: Query) {
  // Previously each condition's raw indicator string went straight into the
  // query unresolved - same bug as structuredQuery had. Now resolved the
  // same way, per condition.
  const conditionResolutions = await Promise.all(
    query.conditions.map(async (condition: Query) => ({
      condition,
      resolution: await resolveIndicator(condition.indicator, query),
    })),
  );

  const unresolved = conditionResolutions.filter((c) => c.resolution.status === "unresolved");
  if (unresolved.length > 0) {
    return {
      success: true,
      intent: query.intent,
      matching_count: 0,
      data: [],
      clarification_needed: true,
      unresolved_indicators: unresolved.map((c) => ({
        requested: c.condition.indicator,
        suggestions: c.resolution.candidates.map((cand) => cand.indicator),
      })),
    };
  }

  const resolvedConditions = conditionResolutions.map(({ condition, resolution }) => ({
    ...condition,
    indicator: resolution.indicators[0],
  }));
  const indicators = resolvedConditions.map((c) => c.indicator);

  let builder = supabase.from("observations").select("*");
  builder = applyCommonFilters(builder, {
    ...query,
    entity_type: query.entity_type ?? query.entity?.type ?? "district",
  });
  builder = builder.in("indicator", indicators);

  const { data, error } = await builder;
  if (error) throw error;

  const grouped: Record<string, Record<string, any>> = {};
  for (const observation of data ?? []) {
    grouped[observation.entity_name] ??= {};
    grouped[observation.entity_name][observation.indicator] = observation;
  }

  const matchesFound = Object.entries(grouped)
    .filter(([, observations]) => resolvedConditions.every((condition) => {
      const observation = observations[condition.indicator];
      return observation && matches(observation.value, condition.operator, condition.value);
    }))
    .map(([entity_name, observations]) => ({
      entity_name,
      entity_type: query.entity_type ?? query.entity?.type ?? "district",
      year: query.year ?? query.time?.year ?? null,
      observations,
    }));

  return { success: true, intent: query.intent, matching_count: matchesFound.length, data: matchesFound };
}

async function semanticQuery(query: Query) {
  const keywords = query.query.split(/\s+/).filter((word: string) => word.length > 3);
  let builder = supabase.from("document_chunks").select("*").limit(10);
  if (query.domain) builder = builder.eq("domain", query.domain);

  if (keywords.length) {
    builder = builder.or(keywords.map((word: string) => `chunk_text.ilike.%${word}%`).join(","));
  }

  const { data, error } = await builder;
  if (error) throw error;
  return { success: true, intent: "semantic_search", query: query.query, chunks_found: data?.length ?? 0, data: data ?? [] };
}

async function execute(query: Query): Promise<any> {
  const validationError = validateQuery(query);
  if (validationError) throw new Error(validationError);

  switch (query.intent) {
    case "compare_indicators":
    case "cross_indicator_query":
      return compareQuery(query);
    case "cross_domain_query":
      return crossDomainQuery(query);
    case "semantic_search":
      return semanticQuery(query);
    case "hybrid": {
      const [structured, semantic] = await Promise.all([
        execute(query.structured),
        execute(query.semantic),
      ]);
      return { success: true, intent: "hybrid", data: { structured_observations: structured, document_chunks: semantic } };
    }
    default:
      return structuredQuery(query);
  }
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const query = await request.json();
    const result = await execute(query);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Query failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});