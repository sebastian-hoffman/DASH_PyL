import React, { useState } from "react";

interface ImportSummary {
  anterior: {
    total_filas: number;
    periodos: string[];
  };
  nuevo: {
    total_filas: number;
    periodos: string[];
  };
  cambios: {
    filas_nuevas: number;
    periodos_agregados: string[];
    periodos_actualizados: string[];
    periodos_removidos: string[];
  };
}

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (summary: ImportSummary) => void;
  apiBase: string;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  apiBase,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [changelogNotes, setChangelogNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError("");
      setSummary(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Por favor selecciona un archivo");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");
    setSummary(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("changelog_notes", changelogNotes);
    formData.append("uploaded_by", "web-ui");

    try {
      const response = await fetch(`${apiBase}/api/import`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Import failed");
      }

      const data = await response.json();
      setSummary(data.summary);
      setSuccess(`✓ ${data.summary.nuevo.total_filas} filas importadas correctamente`);
      setFile(null);
      setChangelogNotes("");

      setTimeout(() => {
        onSuccess(data.summary);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar archivo");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-import" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Importar datos P&L</h2>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="data-file-input">
              Seleccionar archivo Excel (.xlsx, .xls)
            </label>
            <input
              id="data-file-input"
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
              disabled={isLoading}
              required
            />
            {file && <p className="file-name">Archivo: {file.name}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="import-notes">
              Notas de cambio (opcional)
            </label>
            <textarea
              id="import-notes"
              value={changelogNotes}
              onChange={(e) => setChangelogNotes(e.target.value)}
              placeholder="Ej: Actualización Q2, correcciones de julio..."
              disabled={isLoading}
              rows={2}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          {summary && (
            <div className="import-summary">
              <h4>Resumen de cambios</h4>
              <div className="summary-row">
                <span>Filas anteriores:</span>
                <strong>{summary.anterior.total_filas}</strong>
              </div>
              <div className="summary-row">
                <span>Filas nuevas:</span>
                <strong>{summary.nuevo.total_filas}</strong>
              </div>
              <div className="summary-row">
                <span>Diferencia:</span>
                <strong className={summary.cambios.filas_nuevas >= 0 ? "positive" : "negative"}>
                  {summary.cambios.filas_nuevas > 0 ? "+" : ""}
                  {summary.cambios.filas_nuevas}
                </strong>
              </div>

              {summary.cambios.periodos_agregados.length > 0 && (
                <div className="summary-section">
                  <strong>Períodos agregados:</strong>
                  <p>{summary.cambios.periodos_agregados.join(", ")}</p>
                </div>
              )}

              {summary.cambios.periodos_actualizados.length > 0 && (
                <div className="summary-section">
                  <strong>Períodos actualizados:</strong>
                  <p>{summary.cambios.periodos_actualizados.join(", ")}</p>
                </div>
              )}

              {summary.cambios.periodos_removidos.length > 0 && (
                <div className="summary-section warning">
                  <strong>Períodos removidos:</strong>
                  <p>{summary.cambios.periodos_removidos.join(", ")}</p>
                </div>
              )}
            </div>
          )}

          {success && <div className="success-message">{success}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              {success ? "Cerrar" : "Cancelar"}
            </button>
            {!success && (
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading || !file}
              >
                {isLoading ? "Importando..." : "Importar datos"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
