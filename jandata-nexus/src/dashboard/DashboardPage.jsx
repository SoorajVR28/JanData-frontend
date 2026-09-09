import { useState } from "react";
import { runJanDataPipeline } from "../services/jandataPipeline.js";
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
import "./Dashboard.css";

function getObservationResults(dbResults) {
  if (Array.isArray(dbResults?.data)) return dbResults.data;
  if (Array.isArray(dbResults?.data?.results)) return dbResults.data.results;
  if (dbResults?.data?.data && typeof dbResults.data.data === "object") {
    return Object.entries(dbResults.data.data).map(([indicator, observation]) => ({
      indicator,
      ...(observation || {}),
    }));
  }
  if (Array.isArray(dbResults?.data?.structured_observations?.data)) {
    return dbResults.data.structured_observations.data;
  }
  return [];
}

function hasBackendData(dbResults) {
  if (!dbResults) return false;
  if (typeof dbResults.count === "number") return dbResults.count > 0;
  if (typeof dbResults.chunks_found === "number") return dbResults.chunks_found > 0;
  if (typeof dbResults.matching_count === "number") return dbResults.matching_count > 0;
  if (Array.isArray(dbResults.data)) return dbResults.data.length > 0;
  if (dbResults.data?.data && typeof dbResults.data.data === "object") {
    return Object.keys(dbResults.data.data).length > 0;
  }
  return Boolean(dbResults.data?.structured_observations || dbResults.data?.document_chunks);
}

function SuccessState({ result }) {
  const results = getObservationResults(result.dbResults);
  const resultCount = result.dbResults?.count ?? results.length;

  return (
    <div className="dashboard-success">
      <QueryOverview
        question={result.userQuestion}
        resultCount={resultCount}
      />
      <section className="dashboard-section answer-section">
        <p className="dashboard-kicker">JanData Nexus answer</p>
        <p className="answer-text">{result.answer}</p>
      </section>
      <QueryInspector query={result.controlledQuery} />
      <StatCards results={results} />
      <ChartsSection results={results} />
      <ProvenancePanel results={results} />
    </div>
  );
}

function EmptyResultState({ result }) {
  return (
    <div className="dashboard-success">
      <QueryOverview question={result.userQuestion} resultCount={0} />
      <section className="dashboard-section answer-section">
        <p className="dashboard-kicker">Evidence check</p>
        <p className="answer-text">
          {result.answer || "No observation matched this question."}
        </p>
      </section>
      <QueryInspector query={result.controlledQuery} />
      <NoResultsState onRetry={() => window.location.reload()} />
    </div>
  );
}

function DashboardPage() {
  const [status, setStatus] = useState("idle");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function submitQuestion(event) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const pipelineResult = await runJanDataPipeline(trimmedQuestion);
      if (!pipelineResult.success) {
        setErrorMessage(pipelineResult.error || pipelineResult.answer);
        setStatus("error");
        return;
      }

      setResult(pipelineResult);
      setStatus(hasBackendData(pipelineResult.dbResults) ? "success" : "empty");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load query results."
      );
      setStatus("error");
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>JanData Nexus</h1>
          <p>Ask questions about verified government data and reports</p>
        </div>
      </header>

      <div className="dashboard-panel">
        <form className="question-form" onSubmit={submitQuestion}>
          <label htmlFor="jan-data-question">Ask JanData Nexus</label>
          <div className="question-controls">
            <input
              id="jan-data-question"
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What was the paddy production in Dakshina Kannada in 2026?"
              disabled={status === "loading"}
            />
            <button type="submit" disabled={status === "loading" || !question.trim()}>
              {status === "loading" ? "Working..." : "Ask"}
            </button>
          </div>
        </form>

        {status === "idle" && (
          <div className="dashboard-state">
            <h2 className="dashboard-state-title">Start with a question</h2>
            <p className="dashboard-state-text">
              The AI will translate your question into a controlled query, send it to the JanData backend, and explain the returned evidence.
            </p>
          </div>
        )}

        {status === "loading" && <LoadingState />}

        {status === "error" && (
          <ErrorState
            message={errorMessage}
            onRetry={() => submitQuestion({ preventDefault() {} })}
          />
        )}

        {status === "empty" && result && <EmptyResultState result={result} />}

        {status === "success" && result && <SuccessState result={result} />}
      </div>
    </div>
  );
}

export default DashboardPage;
