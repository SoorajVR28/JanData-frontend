import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
  } from "recharts";
  
  export default function ComparisonChart({ results = [] }) {
    if (!results.length) {
      return (
        <div className="dashboard-card chart-card">
          <h3>Area Sown by District</h3>
          <p className="muted-text">No data available for visualization.</p>
        </div>
      );
    }
  
    const chartData = results.map((item) => ({
      name: item.entity_name,
      value: Number(item.value),
    }));
  
    const unit = results[0]?.unit || "";
  
    return (
      <div className="dashboard-card chart-card">
        <div className="chart-header">
          <div>
            <h3>Area Sown by District — Kharif 2026</h3>
            <p className="muted-text">
              Comparison of standardized observations
            </p>
          </div>
          {unit && <span className="chart-unit">{unit}</span>}
        </div>
  
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 10, bottom: 50 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
  
              <XAxis
                dataKey="name"
                angle={-25}
                textAnchor="end"
                interval={0}
              />
  
              <YAxis />
  
              <Tooltip
                formatter={(value) => [`${value} ${unit}`, "Value"]}
              />
  
              <Bar dataKey="value" name="Value" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }