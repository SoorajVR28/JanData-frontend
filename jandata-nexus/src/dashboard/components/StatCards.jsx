import StatCard from "./StatCard";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function average(numbers) {
  if (!numbers.length) {
    return null;
  }

  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function formatAverageValue(value, unit) {
  if (value === null) {
    return "—";
  }

  const formatted = value.toFixed(2);
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatConfidence(value) {
  if (value === null) {
    return "—";
  }

  return `${Math.round(value * 100)}%`;
}

function resolveUnit(results) {
  const withUnit = results.find((row) => row.unit);
  return withUnit?.unit ?? "";
}

function entityLabel(results, distinctCount) {
  const types = new Set(
    results.map((row) => row.entity_type).filter(Boolean)
  );

  if (types.size === 1 && types.has("district")) {
    return distinctCount === 1 ? "district" : "districts";
  }

  return distinctCount === 1 ? "entity" : "entities";
}

function StatCards({ results }) {
  const rows = results ?? [];
  const numericValues = rows.map((row) => row.value).filter(isFiniteNumber);
  const confidences = rows.map((row) => row.confidence).filter(isFiniteNumber);
  const distinctEntities = new Set(
    rows.map((row) => row.entity_name).filter(Boolean)
  );
  const unit = resolveUnit(rows);
  const distinctCount = distinctEntities.size;

  return (
    <section className="dashboard-section stat-cards-section">
      <p className="dashboard-kicker">Summary</p>
      <h2>Key statistics</h2>

      <div className="stat-cards">
        <StatCard
          label="Total results"
          value={String(rows.length)}
          hint="Rows returned by this query"
        />
        <StatCard
          label="Distinct entities"
          value={String(distinctCount)}
          hint={`${distinctCount} unique ${entityLabel(rows, distinctCount)}`}
        />
        <StatCard
          label="Average value"
          value={formatAverageValue(average(numericValues), unit)}
          hint={unit ? `Mean of reported values (${unit})` : "Mean of reported values"}
        />
        <StatCard
          label="Average confidence"
          value={formatConfidence(average(confidences))}
          hint="Mean extraction confidence"
        />
      </div>
    </section>
  );
}

export default StatCards;
