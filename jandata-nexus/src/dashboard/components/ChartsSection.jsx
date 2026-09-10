import ComparisonChart from "./ComparisonChart";
import TrendChart from "./TrendChart";

export default function ChartsSection({ results = [] }) {
  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <h2>Data Visualization</h2>
        <p>Visual representation of the standardized query results.</p>
      </div>

      <div className="charts-grid">
        <ComparisonChart results={results} />
        <TrendChart results={results} />
      </div>
    </section>
  );
}