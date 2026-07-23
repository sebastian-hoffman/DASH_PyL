import React, { useState, useEffect } from "react";

interface ImportRecord {
  id: number;
  filename: string;
  uploaded_at: string;
  uploaded_by: string;
  summary: {
    anterior: { total_filas: number; periodos: string[] };
    nuevo: { total_filas: number; periodos: string[] };
    cambios: {
      filas_nuevas: number;
      periodos_agregados: string[];
      periodos_actualizados: string[];
      periodos_removidos: string[];
    };
  };
}

interface ImportHistoryProps {
  apiBase: string;
}

export const ImportHistory: React.FC<ImportHistoryProps> = ({ apiBase }) => {
  const [records, setRecords] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`${apiBase}/api/import-history`);
        if (!response.ok) throw new Error("Failed to fetch history");
        const data = await response.json();
        setRecords(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading history");
      } finally {
        setLoading(false);
      }
    };

    void fetchHistory();
  }, [apiBase]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-AR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return <div className="import-history">Cargando historial...</div>;
  }

  if (error) {
    return <div className="import-history error-message">{error}</div>;
  }

  if (records.length === 0) {
    return (
      <div className="import-history">
        <p className="muted-hint">Sin importaciones aún</p>
      </div>
    );
  }

  return (
    <div className="import-history">
      <h3>Historial de importaciones ({records.length})</h3>
      <div className="import-records">
        {records.map((record) => (
          <div key={record.id} className="import-record">
            <div
              className="record-header"
              onClick={() =>
                setExpandedId(expandedId === record.id ? null : record.id)
              }
            >
              <div className="record-title">
                <strong>{record.filename}</strong>
                <span className="record-date">{formatDate(record.uploaded_at)}</span>
              </div>
              <div className="record-stats">
                <span className="stat">
                  {record.summary.nuevo.total_filas} filas
                </span>
                <span className="stat">
                  por {record.uploaded_by}
                </span>
                <span className={`toggle ${expandedId === record.id ? "expanded" : ""}`}>
                  ▼
                </span>
              </div>
            </div>

            {expandedId === record.id && (
              <div className="record-details">
                <div className="detail-row">
                  <span>Anterior:</span>
                  <strong>{record.summary.anterior.total_filas} filas</strong>
                </div>
                <div className="detail-row">
                  <span>Nuevo:</span>
                  <strong>{record.summary.nuevo.total_filas} filas</strong>
                </div>
                <div className="detail-row">
                  <span>Diferencia:</span>
                  <strong
                    className={
                      record.summary.cambios.filas_nuevas >= 0
                        ? "positive"
                        : "negative"
                    }
                  >
                    {record.summary.cambios.filas_nuevas > 0 ? "+" : ""}
                    {record.summary.cambios.filas_nuevas}
                  </strong>
                </div>

                {record.summary.cambios.periodos_agregados.length > 0 && (
                  <div className="detail-section">
                    <span className="label">Períodos agregados:</span>
                    <p className="periods">
                      {record.summary.cambios.periodos_agregados.join(", ")}
                    </p>
                  </div>
                )}

                {record.summary.cambios.periodos_actualizados.length > 0 && (
                  <div className="detail-section">
                    <span className="label">Períodos actualizados:</span>
                    <p className="periods">
                      {record.summary.cambios.periodos_actualizados.join(", ")}
                    </p>
                  </div>
                )}

                {record.summary.cambios.periodos_removidos.length > 0 && (
                  <div className="detail-section warning">
                    <span className="label">Períodos removidos:</span>
                    <p className="periods">
                      {record.summary.cambios.periodos_removidos.join(", ")}
                    </p>
                  </div>
                )}

                <div className="detail-section">
                  <span className="label">Períodos en BD después:</span>
                  <p className="periods">
                    {record.summary.nuevo.periodos.join(", ")}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
