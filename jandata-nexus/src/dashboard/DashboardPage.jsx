import { useCallback, useEffect, useState } from "react";
import { getQueryResult } from "./api/queryClient";
import {
  ErrorState,
  LoadingState,
  NoResultsState,
} from "./components/DashboardStates";
import QueryInspector from "./components/QueryInspector";
import QueryOverview from "./components/QueryOverview";
import StatCards from "./components/StatCards";
import ChartsSection from "./components/ChartsSection";
import ProvenancePanel from "./components/ProvenancePanel";
import { mockQueryParams, mockSampleQuestion } from "./mock/queryResponse";
import "./Dashboard.css";

function SuccessState({ data }) {
  const results = data?.results ?? [];
  const resultCount = data?.count ?? results.length;

  return (
    <div className="dashboard-success">
      <QueryOverview
        question="Bidar district observations for 2025"
        resultCount={resultCount}
      />
      <QueryInspector query={{
        indicator: "All indicators",
        entity_type: "district",
        year: 2025,
        min_value: null,
        max_value: null,
        include_flagged: false,
      }}
      />
      <StatCards results={results} />
      <ChartsSection results={results} />
      <ProvenancePanel results={results} />
    </div>
  );
}

function DashboardPage() {
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  

  const loadResults = useCallback(async () => {
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await getQueryResult({
        entityName: "Bidar",
        year: 2025,
      });

      if (!response?.results?.length) {
        setData(response);
        setStatus("empty");
        return;
      }

      setData(response);
      setStatus("success");
    } catch (error) {
      setData(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load query results."
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Data dashboard</h1>
          <p>Visual preview of structured government query results</p>
        </div>
      </header>

      <div className="dashboard-panel">
        

        {status === "loading" && <LoadingState />}

        {status === "error" && (
          <ErrorState
            message={errorMessage}
            onRetry={() => loadResults()}
          />
        )}

        {status === "empty" && (
          <NoResultsState onRetry={() => loadResults()} />
        )}

        {status === "success" && data && <SuccessState data={data} />}
      </div>
    </div>
  );
}

export default DashboardPage;
