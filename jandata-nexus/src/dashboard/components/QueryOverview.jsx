function QueryOverview({ question, resultCount }) {
  const count = resultCount ?? 0;

  return (
    <section className="dashboard-section query-overview">
      <p className="dashboard-kicker">Query result overview</p>

      <h2>Query results</h2>

      <p className="query-overview-question">{question}</p>

      <p className="query-overview-count">
        {count} result{count === 1 ? "" : "s"} returned
      </p>

      <p className="query-overview-note">
        These figures are retrieved directly from the JanData Nexus
        Supabase database.
      </p>
    </section>
  );
}

export default QueryOverview;
