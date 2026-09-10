import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
  } from "recharts";
  
  export default function TrendChart({ results = [] }) {
    const years = [...new Set(results.map((item) => item.year))];
  
    if (years.length < 2) {
      return (
        <div className="dashboard-card chart-card">
          <h3>Year-over-Year Trend</h3>
          <p className="muted-text">
            A trend will appear when data for multiple years is available.
          </p>
        </div>
      );
    }
  
    const chartData = results.map((item) => ({
      year: item.year,
      value: Number(item.value),
    }));
  
    const unit = results[0]?.unit || "";
  
    return (
      <div className="dashboard-card chart-card">
        <div className="chart-header">
          <div>
            <h3>Year-over-Year Trend</h3>
            <p className="muted-text">
              Change in standardized observations over time
            </p>
          </div>
          {unit && <span className="chart-unit">{unit}</span>}
        </div>
  
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip
                formatter={(value) => [`${value} ${unit}`, "Value"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                name="Value"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }