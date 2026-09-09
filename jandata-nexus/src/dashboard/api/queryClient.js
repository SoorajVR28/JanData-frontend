import { supabase } from "./supabaseClient";

export async function getQueryResult(options = {}) {
  const {
    entityName,
    indicator,
    year,
  } = options;

  let query = supabase
    .from("observations")
    .select("*")
    .order("year", { ascending: true });

  if (entityName) {
    query = query.eq("entity_name", entityName);
  }

  if (indicator) {
    query = query.eq("indicator", indicator);
  }

  if (year) {
    query = query.eq("year", year);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Supabase query error:", error);
    throw new Error("Unable to load government data. Please try again.");
  }

  const results = data || [];

  return {
    results,
    count: results.length,
  };
}
