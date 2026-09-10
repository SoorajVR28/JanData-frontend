export default function ProvenancePanel({ results = [] }) {
    if (!results.length) {
      return null;
    }
  
    return (
      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Data Provenance</h2>
          <p>
            Trace each standardized observation back to its source and
            extraction details.
          </p>
        </div>
  
        <div className="provenance-list">
          {results.map((item, index) => (
            <div
              className="provenance-card"
              key={`${item.entity_name}-${item.year}-${index}`}
            >
              <div className="provenance-card-header">
                <div>
                  <h3>{item.entity_name}</h3>
                  <p>
                    {item.indicator} · {item.year}
                  </p>
                </div>
  
                <span
                  className={`confidence-badge ${
                    Number(item.confidence) >= 0.9
                      ? "confidence-high"
                      : Number(item.confidence) >= 0.7
                        ? "confidence-medium"
                        : "confidence-low"
                  }`}
                >
                  {item.confidence != null
                    ? `${Math.round(Number(item.confidence) * 100)}% confidence`
                    : "Confidence unavailable"}
                </span>
              </div>
  
              <div className="provenance-details">
                <div className="provenance-detail">
                  <span>Source document</span>
                  <strong>{item.source_document || "Not available"}</strong>
                </div>
  
                <div className="provenance-detail">
                  <span>Source page</span>
                  <strong>
                    {item.source_page != null
                      ? `Page ${item.source_page}`
                      : "Not available"}
                  </strong>
                </div>
  
                <div className="provenance-detail">
                  <span>Extraction method</span>
                  <strong>
                    {item.extraction_method || "Not available"}
                  </strong>
                </div>
  
                <div className="provenance-detail">
                  <span>Validation</span>
                  <strong
                    className={
                      item.validation_flag
                        ? "validation-valid"
                        : "validation-warning"
                    }
                  >
                    {item.validation_flag ? "✓ Validated" : "⚠ Review required"}
                  </strong>
                </div>
              </div>
  
              {item.validation_reason && (
                <p className="validation-reason">
                  {item.validation_reason}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }