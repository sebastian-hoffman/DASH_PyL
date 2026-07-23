import type {
  ActiveTab,
  BreakdownResponse,
  BuMatrixResponse,
  DimDrillState,
  DrillScope,
  GroupBy,
  MatrixScope,
  Metric,
  PeriodOption,
  PnlRow,
  Section,
  UnitCcBreakdownResponse,
  UnitCcMatrixResponse,
  UnitPnlResponse,
} from "../types/index.js";
import { fmtCurrency } from "../utils/format.js";

interface Props {
  // Period selector
  allPeriods: PeriodOption[];
  selectedPeriods: string[];
  showMonthColumns: boolean;
  showQuarterColumn: boolean;
  colPeriods: PeriodOption[];
  togglePeriod: (p: string) => void;
  setShowMonthColumns: (v: boolean) => void;
  setShowQuarterColumn: (v: boolean) => void;

  // P&L table
  filteredRows: PnlRow[];
  loading: boolean;
  lineAmounts: Record<string, Record<string, number>>;
  onAdjust: (id: string, label: string) => void;

  // Drill panel
  dimDrill: DimDrillState;
  drillLabel: string;
  drillScope: DrillScope;
  drillScopeLabel: string;
  setDrillScope: (s: DrillScope) => void;
  openDimDrill: (row: PnlRow) => void;
  openCcDrill: (lineId: string, dim: string) => void;
  openMovements: (lineId: string, dim: string, cc: string) => void;
  drillBreadcrumb: () => string;
  drillBack: () => void;
  setDimDrill: (d: DimDrillState) => void;

  // Breakdown
  groupBy: GroupBy;
  setGroupBy: (v: GroupBy) => void;
  breakSection: Section;
  setBreakSection: (v: Section) => void;
  breakMetric: Metric;
  setBreakMetric: (v: Metric) => void;
  breakdown: BreakdownResponse | null;
  breakShowMonths: boolean;
  setBreakShowMonths: (v: boolean) => void;
  breakShowQuarter: boolean;
  setBreakShowQuarter: (v: boolean) => void;
  breakShowYtd: boolean;
  setBreakShowYtd: (v: boolean) => void;
  breakdownMonthColumns: { label: string; idx: number }[];
  breakdownQuarterLabels: string[];
  getQuarterValue: (months: number[], q: string) => number;
  onOpenUnit: (group: string, section?: Section) => void;

  // BU matrix
  buMatrixScope: MatrixScope;
  setBuMatrixScope: (v: MatrixScope) => void;
  buMatrixSection: Section;
  setBuMatrixSection: (v: Section) => void;
  buMatrix: BuMatrixResponse | null;

  // Unit P&L
  unitPnl: UnitPnlResponse | null;
  setUnitPnl: (v: UnitPnlResponse | null) => void;
  unitCcBreakdown: UnitCcBreakdownResponse | null;
  setUnitCcBreakdown: (v: UnitCcBreakdownResponse | null) => void;
  unitCcMetric: Metric;
  setUnitCcMetric: (v: Metric) => void;
  unitCcMatrix: UnitCcMatrixResponse | null;
  unitCcMatrixOpen: boolean;
  setUnitCcMatrixOpen: (fn: (prev: boolean) => boolean) => void;
  unitCcMatrixScope: MatrixScope;
  setUnitCcMatrixScope: (v: MatrixScope) => void;

  // Navigation
  setActiveTab: (tab: ActiveTab) => void;
}

const drillableRow = (r: PnlRow) => r.kind === "detail" || r.kind === "kpi";

export function AnalisisTab(p: Props) {
  return (
    <>
      {/* ── PERIOD SELECTOR ── */}
      <section className="table-card">
        <h2>Selector de períodos</h2>
        <p className="small">Elegí los períodos que querés ver como columnas en el Estado de Resultados. Doble click en una línea para ver su apertura por unidad de negocio.</p>
        <div className="period-options">
          <label className="check">
            <input type="checkbox" checked={p.showMonthColumns} onChange={(e) => p.setShowMonthColumns(e.target.checked)} />
            Mostrar meses
          </label>
          <label className="check">
            <input type="checkbox" checked={p.showQuarterColumn} onChange={(e) => p.setShowQuarterColumn(e.target.checked)} />
            Mostrar trimestre
          </label>
        </div>
        <div className="period-picker">
          {p.allPeriods.map((o) => (
            <button key={o.period} type="button"
              className={p.selectedPeriods.includes(o.period) ? "period-btn active" : "period-btn"}
              onClick={() => p.togglePeriod(o.period)}>
              {o.period}
            </button>
          ))}
        </div>
        {p.showMonthColumns && p.selectedPeriods.length === 0 && (
          <p className="small warn">Seleccioná al menos un período.</p>
        )}
      </section>

      {/* ── P&L TABLE ── */}
      <section className="table-card">
        <h2>Estado de Resultados</h2>
        {p.loading ? <p>Cargando…</p> : null}
        <div className="drill-table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Concepto</th>
                {p.colPeriods.map((o) => <th key={o.period}>{o.period}</th>)}
                {p.showQuarterColumn ? <th>Trimestre</th> : null}
                <th>YTD</th>
                <th>Ajuste</th>
              </tr>
            </thead>
            <tbody>
              {p.filteredRows.map((r) => (
                <tr key={r.id}
                  className={r.kind === "section" ? "section-row" : r.kind === "kpi" ? "kpi-row" : r.kind === "subtotal" ? "subtotal-row" : "detail-row"}
                  onDoubleClick={drillableRow(r) ? () => p.openDimDrill(r) : undefined}
                  title={drillableRow(r) ? "Doble click para abrir apertura por unidad de negocio" : undefined}>
                  <td className="concept-cell" style={{ paddingLeft: `${12 + r.level * 18}px` }}>
                    {drillableRow(r) ? <span className="drill-hint">⬡</span> : null} {r.label}
                  </td>
                  {p.colPeriods.map((o) => (
                    <td key={o.period}>{fmtCurrency(p.lineAmounts[r.id]?.[o.period] ?? 0)}</td>
                  ))}
                  {p.showQuarterColumn ? <td>{fmtCurrency(r.quarter)}</td> : null}
                  <td>{fmtCurrency(r.ytd)}</td>
                  <td>
                    {drillableRow(r) ? (
                      <button type="button" className="btn-sm"
                        onClick={() => { p.onAdjust(r.id, r.label); p.setActiveTab("ajustes"); }}>
                        Ajustar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── DRILL PANEL ── */}
      <section className="drill-grid">
        <article className="drill-card">
          <div className="drill-header">
            <h2>Apertura por unidad de negocio</h2>
            <label>
              Corte de apertura
              <select value={p.drillScope} onChange={(e) => p.setDrillScope(e.target.value as DrillScope)}>
                <option value="month">Mes actual</option>
                <option value="quarter">Trimestre actual</option>
                <option value="ytd">YTD</option>
                <option value="selected">Períodos seleccionados</option>
              </select>
            </label>
            {p.dimDrill ? (
              <div className="drill-nav">
                <span className="breadcrumb">{p.drillBreadcrumb()}</span>
                <button type="button" className="btn-sm" onClick={p.drillBack}>← Atrás</button>
                <button type="button" className="btn-sm btn-ghost" onClick={() => p.setDimDrill(null)}>✕ Cerrar</button>
              </div>
            ) : null}
          </div>

          {!p.dimDrill && (
            <p className="small muted-hint">Hacé doble click en cualquier línea del Estado de Resultados para ver su apertura por Nivel 1 de dimensión (BU/Unidad). En la tabla de Nivel 1: click abre centros de costo, doble click abre el P&L completo de esa unidad.</p>
          )}

          {p.dimDrill?.mode === "dim" && (
            <div className="drill-table-wrap">
              <table>
                <thead><tr><th>Unidad de negocio (Nivel 1)</th><th>{p.drillScopeLabel}</th></tr></thead>
                <tbody>
                  {p.dimDrill.rows.length === 0 && <tr><td colSpan={2} className="muted-hint">Sin datos para esta línea en los períodos seleccionados.</td></tr>}
                  {p.dimDrill.rows.map((row) => (
                    <tr key={row.group} className="clickable"
                      onClick={() => p.openCcDrill(p.dimDrill!.lineId, row.group)}
                      onDoubleClick={() => p.onOpenUnit(row.group, "all")}
                      title="Click: centros de costo | Doble click: P&L completo de la unidad">
                      <td>{row.group} <span className="drill-hint">→</span></td>
                      <td>{fmtCurrency(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {p.dimDrill?.mode === "cc" && (
            <div className="drill-table-wrap">
              <table>
                <thead><tr><th>Centro de costo</th><th>{p.drillScopeLabel}</th></tr></thead>
                <tbody>
                  {p.dimDrill.rows.length === 0 && <tr><td colSpan={2} className="muted-hint">Sin centros de costo para esta unidad.</td></tr>}
                  {p.dimDrill.rows.map((row) => (
                    <tr key={row.costCenter} className="clickable"
                      onClick={() => p.openMovements(p.dimDrill!.lineId, (p.dimDrill as Extract<typeof p.dimDrill, { mode: "cc" }>)!.dim, row.costCenter)}
                      title="Click para ver cuentas">
                      <td>{row.costCenter} <span className="drill-hint">→</span></td>
                      <td>{fmtCurrency(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {p.dimDrill?.mode === "movements" && (
            <div className="drill-table-wrap">
              <table>
                <thead><tr><th>Cuenta contable</th><th>{p.drillScopeLabel}</th></tr></thead>
                <tbody>
                  {p.dimDrill.rows.length === 0 && <tr><td colSpan={2} className="muted-hint">Sin movimientos.</td></tr>}
                  {p.dimDrill.rows.map((d) => (
                    <tr key={d.id}><td>{d.account}</td><td>{fmtCurrency(d.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      {/* ── BREAKDOWN POR BU ── */}
      <section className="table-card">
        <h2>Análisis por BU / Vertical / Área</h2>
        <p className="small">Doble click en una fila para abrir el P&L completo de esa unidad.</p>
        <div className="matrix-controls">
          <label>Agrupar por
            <select value={p.groupBy} onChange={(e) => p.setGroupBy(e.target.value as GroupBy)}>
              <option value="bu">BU (Nivel 1)</option>
              <option value="vertical">Vertical (Nivel 2)</option>
              <option value="area">Área</option>
              <option value="cc">Centro de costo</option>
            </select>
          </label>
          <label>Bloque
            <select value={p.breakSection} onChange={(e) => p.setBreakSection(e.target.value as Section)}>
              <option value="habitual">Negocio habitual</option>
              <option value="especiales">Servicios especiales</option>
              <option value="all">Todo</option>
            </select>
          </label>
          <label>Métrica
            <select value={p.breakMetric} onChange={(e) => p.setBreakMetric(e.target.value as Metric)}>
              <option value="ventas">Ventas</option>
              <option value="margenBruto">Margen Bruto</option>
              <option value="ebitda">EBITDA</option>
            </select>
          </label>
        </div>
        <div className="period-options">
          <label className="check"><input type="checkbox" checked={p.breakShowMonths}  onChange={(e) => p.setBreakShowMonths(e.target.checked)} /> Mostrar meses</label>
          <label className="check"><input type="checkbox" checked={p.breakShowQuarter} onChange={(e) => p.setBreakShowQuarter(e.target.checked)} /> Mostrar trimestre</label>
          <label className="check"><input type="checkbox" checked={p.breakShowYtd}     onChange={(e) => p.setBreakShowYtd(e.target.checked)} /> Mostrar YTD</label>
        </div>
        {!p.breakShowMonths && !p.breakShowQuarter && !p.breakShowYtd ? (
          <p className="small warn">Activá al menos una vista: meses, trimestre o YTD.</p>
        ) : null}
        <div className="drill-table-wrap">
          <table>
            <thead>
              <tr>
                <th>{p.groupBy.toUpperCase()}</th>
                {p.breakShowMonths  ? p.breakdownMonthColumns.map((m) => <th key={m.label}>{m.label}</th>) : null}
                {p.breakShowQuarter ? p.breakdownQuarterLabels.map((q) => <th key={q}>{q}</th>) : null}
                {p.breakShowYtd     ? <th>{p.breakdown?.periods.ytd ?? "YTD"}</th> : null}
              </tr>
            </thead>
            <tbody>
              {(p.breakdown?.rows ?? []).map((r) => (
                <tr key={r.group} className="clickable" onDoubleClick={() => p.onOpenUnit(r.group)} title="Doble click para abrir P&L de la unidad">
                  <td>{r.group}</td>
                  {p.breakShowMonths  ? p.breakdownMonthColumns.map((m) => <td key={`${r.group}-${m.label}`}>{fmtCurrency(r[p.breakMetric].months[m.idx] ?? 0)}</td>) : null}
                  {p.breakShowQuarter ? p.breakdownQuarterLabels.map((q) => <td key={`${r.group}-${q}`}>{fmtCurrency(p.getQuarterValue(r[p.breakMetric].months, q))}</td>) : null}
                  {p.breakShowYtd     ? <td>{fmtCurrency(r[p.breakMetric].ytd)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── P&L COMPLETO POR BU ── */}
      <section className="table-card">
        <h2>Estado de Resultados Completo por BU (Nivel 1)</h2>
        <p className="small">Columnas = Nivel 1 de dimensión.</p>
        <div className="matrix-controls">
          <label>Corte
            <select value={p.buMatrixScope} onChange={(e) => p.setBuMatrixScope(e.target.value as MatrixScope)}>
              <option value="month">Mes</option><option value="quarter">Trimestre</option><option value="ytd">YTD</option>
            </select>
          </label>
          <label>Bloque
            <select value={p.buMatrixSection} onChange={(e) => p.setBuMatrixSection(e.target.value as Section)}>
              <option value="habitual">Negocio habitual</option><option value="especiales">Servicios especiales</option><option value="all">Todo</option>
            </select>
          </label>
        </div>
        <div className="drill-table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>Concepto</th>
                {(p.buMatrix?.columns ?? []).map((c) => <th key={c}>{c}</th>)}
                <th>Total Empresa</th>
              </tr>
            </thead>
            <tbody>
              {(p.buMatrix?.rows ?? []).map((r) => (
                <tr key={`bu-matrix-${r.id}`} className={r.kind === "kpi" ? "kpi-row" : r.kind === "subtotal" ? "subtotal-row" : r.kind === "section" ? "section-row" : "detail-row"}>
                  <td className="concept-cell" style={{ paddingLeft: `${12 + r.level * 18}px` }}>{r.label}</td>
                  {(p.buMatrix?.columns ?? []).map((c) => <td key={`${r.id}-${c}`}>{fmtCurrency(r.values[c] ?? 0)}</td>)}
                  <td>{fmtCurrency(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── P&L UNIDAD ── */}
      {p.unitPnl ? (
        <section className="table-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>P&L unidad: {p.unitPnl.unit}</h2>
            <button type="button" className="btn-ghost" onClick={() => { p.setUnitPnl(null); p.setUnitCcBreakdown(null); }}>✕ Cerrar</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                {p.breakShowMonths  ? <th>{p.unitPnl.periods.month}</th>   : null}
                {p.breakShowQuarter ? <th>{p.unitPnl.periods.quarter}</th> : null}
                {p.breakShowYtd     ? <th>{p.unitPnl.periods.ytd}</th>     : null}
              </tr>
            </thead>
            <tbody>
              {p.unitPnl.rows.map((r) => (
                <tr key={`unit-${r.id}`} className={r.kind === "kpi" ? "kpi-row" : r.kind === "subtotal" ? "subtotal-row" : "detail-row"}>
                  <td>{r.label}</td>
                  {p.breakShowMonths  ? <td>{fmtCurrency(r.month)}</td>   : null}
                  {p.breakShowQuarter ? <td>{fmtCurrency(r.quarter)}</td> : null}
                  {p.breakShowYtd     ? <td>{fmtCurrency(r.ytd)}</td>     : null}
                </tr>
              ))}
            </tbody>
          </table>

          {p.unitCcBreakdown ? (
            <>
              <h3 style={{ marginTop: 16 }}>Apertura por Centro de Costo</h3>
              <div className="matrix-controls">
                <label>Métrica
                  <select value={p.unitCcMetric} onChange={(e) => p.setUnitCcMetric(e.target.value as Metric)}>
                    <option value="ventas">Ventas</option>
                    <option value="margenBruto">Margen Bruto</option>
                    <option value="ebitda">EBITDA</option>
                  </select>
                </label>
                <button type="button" className={p.unitCcMatrixOpen ? "btn-sm" : "btn-ghost"}
                  onClick={() => p.setUnitCcMatrixOpen((v) => !v)}>
                  {p.unitCcMatrixOpen ? "Ocultar vista por CC (columnas)" : "Abrir por CC"}
                </button>
              </div>
              <div className="drill-table-wrap" style={{ marginTop: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Centro de costo</th>
                      {p.breakShowMonths ? (p.unitCcBreakdown.monthLabels ?? []).map((m) => <th key={`unit-cc-${m}`}>{m}</th>) : null}
                      {p.breakShowYtd    ? <th>{p.unitCcBreakdown.periods.ytd}</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {(p.unitCcBreakdown.rows ?? []).map((r) => (
                      <tr key={`unit-cc-row-${r.costCenter}`}>
                        <td>{r.costCenter}</td>
                        {p.breakShowMonths ? r[p.unitCcMetric].months.map((v, i) => <td key={`unit-cc-${r.costCenter}-${i}`}>{fmtCurrency(v)}</td>) : null}
                        {p.breakShowYtd    ? <td>{fmtCurrency(r[p.unitCcMetric].ytd)}</td> : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {p.unitCcMatrixOpen ? (
                <div className="drill-table-wrap" style={{ marginTop: 14 }}>
                  <div className="matrix-controls" style={{ marginBottom: 8 }}>
                    <label>Corte matriz CC
                      <select value={p.unitCcMatrixScope} onChange={(e) => p.setUnitCcMatrixScope(e.target.value as MatrixScope)}>
                        <option value="month">Mes</option><option value="quarter">Trimestre</option><option value="ytd">YTD</option>
                      </select>
                    </label>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ minWidth: 240 }}>Concepto</th>
                        {(p.unitCcMatrix?.columns ?? []).map((c) => <th key={`unit-cc-col-${c}`}>{c}</th>)}
                        <th>Total unidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(p.unitCcMatrix?.rows ?? []).map((r) => (
                        <tr key={`unit-cc-matrix-${r.id}`} className={r.kind === "kpi" ? "kpi-row" : r.kind === "subtotal" ? "subtotal-row" : r.kind === "section" ? "section-row" : "detail-row"}>
                          <td className="concept-cell" style={{ paddingLeft: `${12 + r.level * 18}px` }}>{r.label}</td>
                          {(p.unitCcMatrix?.columns ?? []).map((c) => <td key={`${r.id}-${c}`}>{fmtCurrency(r.values[c] ?? 0)}</td>)}
                          <td>{fmtCurrency(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
