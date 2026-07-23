import { useState } from "react";
import { fetchCcExplorer } from "../api/client.js";
import type { PeriodOption } from "../types/index.js";
import { fmtCurrency } from "../utils/format.js";

interface CcExplorerRow { account: string; level2: string; level3: string; total: number }
interface CcExplorerResult {
  cc: string; periods: string[]; grandTotal: number;
  rows: CcExplorerRow[]; availableCCs: string[];
}

interface Props {
  allPeriods: PeriodOption[];
}

export function CcExplorerTab({ allPeriods }: Props) {
  const [cc, setCc]               = useState("");
  const [period, setPeriod]       = useState("");
  const [result, setResult]       = useState<CcExplorerResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [available, setAvailable] = useState<string[]>([]);

  const run = async () => {
    if (!cc.trim()) return;
    setLoading(true);
    const data = await fetchCcExplorer(cc.trim(), period.trim() || undefined);
    setResult(data);
    if (data.availableCCs?.length) setAvailable(data.availableCCs);
    setLoading(false);
  };

  return (
    <section className="table-card">
      <h2>Explorador por Centro de Costo</h2>
      <p className="small">Buscá todos los movimientos de un centro de costo en un período determinado, sin importar a qué línea del P&L pertenecen.</p>

      <div className="matrix-controls" style={{ alignItems: "flex-end", gap: 12 }}>
        <label>Centro de costo
          <input list="cc-list" value={cc} onChange={(e) => setCc(e.target.value)}
            placeholder="Ej: PRD, CORP, etc." style={{ minWidth: 180 }} />
          <datalist id="cc-list">
            {available.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label>Período (YYYY-MM)
          <input list="explorer-period-list" value={period} onChange={(e) => setPeriod(e.target.value)}
            placeholder="Ej: 2025-11 (vacío = todos)" style={{ minWidth: 160 }} />
          <datalist id="explorer-period-list">
            {allPeriods.map((o) => <option key={o.period} value={o.period} />)}
          </datalist>
        </label>
        <button type="button" onClick={() => void run()} disabled={loading || !cc.trim()}>
          {loading ? "Buscando…" : "Explorar"}
        </button>
      </div>

      {result ? (
        result.rows.length === 0 ? (
          <p className="small warn" style={{ marginTop: 16 }}>
            Sin movimientos para <strong>{result.cc}</strong> en {result.periods.join(", ") || "todos los períodos"}.
          </p>
        ) : (
          <>
            <p className="small" style={{ marginTop: 16 }}>
              <strong>{result.cc}</strong> — períodos: {result.periods.join(", ")} — Total: <strong>{fmtCurrency(result.grandTotal)}</strong>
            </p>
            <div className="drill-table-wrap">
              <table>
                <thead>
                  <tr><th>Cuenta contable</th><th>Categoría (nivel 3)</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={`cc-exp-${r.account}`}>
                      <td>{r.account}</td>
                      <td className="muted-hint">{r.level3 || r.level2}</td>
                      <td>{fmtCurrency(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : (
        !loading ? <p className="small muted-hint" style={{ marginTop: 16 }}>Ingresá un centro de costo y hacé click en Explorar.</p> : null
      )}
    </section>
  );
}
