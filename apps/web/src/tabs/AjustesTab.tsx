import type { AdjustmentOptions, SavedAdjustment } from "../types/index.js";
import { fmtCurrency } from "../utils/format.js";

interface Props {
  adjLineId: string | null;
  adjLineLabel: string;
  adjKind: "reclassification" | "result_impact";
  setAdjKind: (v: "reclassification" | "result_impact") => void;
  adjAmount: number;
  setAdjAmount: (v: number) => void;
  adjDebitAccount: string;  setAdjDebitAccount: (v: string) => void;
  adjDebitCC: string;       setAdjDebitCC: (v: string) => void;
  adjDebitPeriod: string;   setAdjDebitPeriod: (v: string) => void;
  adjCreditAccount: string; setAdjCreditAccount: (v: string) => void;
  adjCreditCC: string;      setAdjCreditCC: (v: string) => void;
  adjCreditPeriod: string;  setAdjCreditPeriod: (v: string) => void;
  adjNote: string;
  setAdjNote: (v: string) => void;
  adjMsg: string;
  adjOptions: AdjustmentOptions;
  onSave: () => void;
  onClear: () => void;
  savedAdjustments: SavedAdjustment[];
}

export function AjustesTab(p: Props) {
  return (
    <>
      <article className="adjust-card">
        <h2>Ajuste de gestión</h2>
        <p className="small">Separá reclasificaciones (resultado vs resultado) de ajustes con impacto en resultado (contra patrimonial), siempre en partida doble.</p>
        {p.adjLineId ? <p className="small">Referencia desde línea: <strong>{p.adjLineLabel}</strong></p> : null}

        <label>
          Tipo de ajuste
          <select value={p.adjKind} onChange={(e) => p.setAdjKind(e.target.value as "reclassification" | "result_impact")}>
            <option value="reclassification">Reclasificación (cuenta/centro)</option>
            <option value="result_impact">Impacto en resultado (contra patrimonial)</option>
          </select>
        </label>

        <label>
          Monto (ARS)
          <input type="number" min={0} value={p.adjAmount} onChange={(e) => p.setAdjAmount(Number(e.target.value || 0))} />
        </label>

        <div className="adj-entry-grid">
          <div className="adj-entry-card">
            <h3>Debe</h3>
            <label>Cuenta
              <select value={p.adjDebitAccount} onChange={(e) => p.setAdjDebitAccount(e.target.value)}>
                <option value="">Seleccionar cuenta</option>
                {p.adjOptions.accounts.map((acc) => <option key={`debit-acc-${acc}`} value={acc}>{acc}</option>)}
              </select>
            </label>
            <label>Centro de costo
              <select value={p.adjDebitCC} onChange={(e) => p.setAdjDebitCC(e.target.value)}>
                <option value="">Seleccionar centro de costo</option>
                {p.adjOptions.costCenters.map((cc) => <option key={`debit-cc-${cc}`} value={cc}>{cc}</option>)}
              </select>
            </label>
            <label>Período
              <select value={p.adjDebitPeriod} onChange={(e) => p.setAdjDebitPeriod(e.target.value)}>
                <option value="">Seleccionar período</option>
                {p.adjOptions.periods.map((per) => <option key={`debit-period-${per}`} value={per}>{per}</option>)}
              </select>
            </label>
          </div>

          <div className="adj-entry-card">
            <h3>Haber</h3>
            <label>Cuenta
              <select value={p.adjCreditAccount} onChange={(e) => p.setAdjCreditAccount(e.target.value)}>
                <option value="">Seleccionar cuenta</option>
                {p.adjOptions.accounts.map((acc) => <option key={`credit-acc-${acc}`} value={acc}>{acc}</option>)}
              </select>
            </label>
            <label>Centro de costo
              <select value={p.adjCreditCC} onChange={(e) => p.setAdjCreditCC(e.target.value)}>
                <option value="">Seleccionar centro de costo</option>
                {p.adjOptions.costCenters.map((cc) => <option key={`credit-cc-${cc}`} value={cc}>{cc}</option>)}
              </select>
            </label>
            <label>Período
              <select value={p.adjCreditPeriod} onChange={(e) => p.setAdjCreditPeriod(e.target.value)}>
                <option value="">Seleccionar período</option>
                {p.adjOptions.periods.map((per) => <option key={`credit-period-${per}`} value={per}>{per}</option>)}
              </select>
            </label>
          </div>
        </div>

        <label>Nota / justificación
          <textarea value={p.adjNote} onChange={(e) => p.setAdjNote(e.target.value)}
            placeholder="Ej: reclasificación de costo entre centros, sin impacto neto" />
        </label>

        <button type="button" onClick={p.onSave}>Guardar ajuste</button>
        <button type="button" className="btn-ghost" onClick={p.onClear}>Limpiar referencia</button>
        {p.adjMsg ? <p className="small adj-ok">{p.adjMsg}</p> : null}
      </article>

      {p.savedAdjustments.length > 0 ? (
        <section className="table-card" style={{ marginTop: 24 }}>
          <h2>Ajustes registrados</h2>
          <div className="drill-table-wrap">
            <table>
              <thead>
                <tr><th>Tipo</th><th>Monto</th><th>Nota</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                {p.savedAdjustments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.kind === "reclassification" ? "Reclasificación" : "Impacto resultado"}</td>
                    <td>{fmtCurrency(a.amount)}</td>
                    <td>{a.note}</td>
                    <td>{new Date(a.createdAt).toLocaleDateString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
