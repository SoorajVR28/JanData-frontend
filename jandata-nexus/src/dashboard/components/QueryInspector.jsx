const QUERY_FIELDS = [
  { key: "indicator", label: "Indicator" },
  { key: "entity_type", label: "Entity type" },
  { key: "year", label: "Year" },
  { key: "min_value", label: "Minimum value" },
  { key: "max_value", label: "Maximum value" },
  { key: "include_flagged", label: "Include flagged rows" },
];

function formatQueryValue(value) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function QueryInspector({ query }) {
  const params = query ?? {};

  return (
    <section className="dashboard-section query-inspector">
      <p className="dashboard-kicker">JanData query inspector</p>
      <h2>Structured query</h2>
      <p className="query-inspector-intro">
      This is the structured query used to retrieve data from the JanData Nexus
      database. It is shown for inspection only and cannot be edited here.
      </p>

      <dl className="query-inspector-list">
        {QUERY_FIELDS.map(({ key, label }) => (
          <div key={key} className="query-inspector-row">
            <dt>{label}</dt>
            <dd>{formatQueryValue(params[key])}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default QueryInspector;
