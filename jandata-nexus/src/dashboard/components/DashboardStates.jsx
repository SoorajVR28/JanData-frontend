export function LoadingState() {
  return (
    <div className="dashboard-state" role="status">
      <p className="dashboard-state-title">Loading results</p>
      <p className="dashboard-state-text">
        Fetching structured government data for this query...
      </p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="dashboard-state dashboard-state-error" role="alert">
      <p className="dashboard-state-title">Could not load data</p>
      <p className="dashboard-state-text">
        {message || "Something went wrong while loading query results."}
      </p>
      {onRetry && (
        <button className="dashboard-button" type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function NoResultsState({ onRetry }) {
  return (
    <div className="dashboard-state">
      <p className="dashboard-state-title">No results</p>
      <p className="dashboard-state-text">
        No matching government data was found for this query.
      </p>
      {onRetry && (
        <button className="dashboard-button" type="button" onClick={onRetry}>
          Load sample results
        </button>
      )}
    </div>
  );
}
