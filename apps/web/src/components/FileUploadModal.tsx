import React, { useState } from "react";

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (file: { filename: string; uploaded_at: string }) => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [changelogNotes, setChangelogNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("changelog_notes", changelogNotes);
    formData.append("uploaded_by", "web-ui");

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();
      setSuccess(`✓ File "${data.file.filename}" uploaded successfully`);
      setFile(null);
      setChangelogNotes("");

      setTimeout(() => {
        onSuccess(data.file);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Subir archivo P&L</h2>
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
            <label htmlFor="file-input">
              Seleccionar archivo Excel (.xlsx, .xls)
            </label>
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
              disabled={isLoading}
              required
            />
            {file && <p className="file-name">Archivo: {file.name}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="changelog">
              Notas de cambio (opcional)
            </label>
            <textarea
              id="changelog"
              value={changelogNotes}
              onChange={(e) => setChangelogNotes(e.target.value)}
              placeholder="Ej: Actualización de costos, corrección de datos..."
              disabled={isLoading}
              rows={3}
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading || !file}
            >
              {isLoading ? "Subiendo..." : "Subir archivo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
