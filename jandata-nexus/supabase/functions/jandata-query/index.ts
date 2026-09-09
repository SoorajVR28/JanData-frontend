import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type Query = Record<string, any>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
);

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

async function resolveIndicator(indicator: string, query: Query) {
  if (indicatorAliases[indicator]) return indicatorAliases[indicator];

  let builder = supabase.from("observations").select("indicator");
  builder = applyCommonFilters(builder, { ...query, domain: undefined });
  const { data, error } = await builder.limit(1000);
  if (error || !data?.length) return [indicator];

  const candidates = [...new Set(data.map((row: Query) => row.indicator).filter(Boolean))];
  const best = candidates
    .map((candidate: string) => ({ candidate, score: indicatorScore(indicator, candidate) }))
    .sort((left, right) => right.score - left.score)[0];

  return best && best.score >= 70 ? [best.candidate] : [indicator];
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

async function structuredQuery(query: Query) {
  const requestedIndicators = query.indicator
    ? [query.indicator]
    : getIndicators(query);
  const resolvedIndicators = (await Promise.all(
    requestedIndicators.map((indicator: string) => resolveIndicator(indicator, query)),
  )).flat();

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

  return { success: true, intent: query.intent, count: data?.length ?? 0, data: data ?? [] };
}

async function compareQuery(query: Query) {
  const result = await structuredQuery(query);
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
  const indicators = query.conditions.map((condition: Query) => condition.indicator);
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
    .filter(([, observations]) => query.conditions.every((condition: Query) => {
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
