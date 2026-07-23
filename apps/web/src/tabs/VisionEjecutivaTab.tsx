import { Fragment, useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCurrency, fmtPct } from "../utils/format";

export type ExecutiveMetric = { value: number; pctRevenue: number };
export type ExecutiveAccountItem = {
  account: string;
  total: number;
  pctOfBranch: number;
  byPeriod: Record<string, number>;
};
export type ExecutiveBranch = {
  id: string;
  label: string;
  group: "ingresos" | "gastos" | "belowLine";
  total: ExecutiveMetric;
  byPeriod: Record<string, ExecutiveMetric>;
  accounts: ExecutiveAccountItem[];
};
export type ExecutiveOverview = {
  periods: string[];
  periodLabel: string;
  revenue: ExecutiveMetric;
  branches: ExecutiveBranch[];
  ebitda: ExecutiveMetric;
  ebitdaByPeriod: Record<string, ExecutiveMetric>;
  netResult: ExecutiveMetric;
  netResultByPeriod: Record<string, ExecutiveMetric>;
};

const apiBase = import.meta.env.VITE_API_URL as string || "http://localhost:4000";

interface Props {
  data: ExecutiveOverview | null;
  loading: boolean;
  availableCostCenters: string[];
  selectedCostCenters: string[];
  onCostCentersChange: (costCenters: string[]) => void;
  year: string;
  availableLevel1Dimensions: string[];
  allPeriods: string[];
  globalSelectedPeriods: string[];
  globalSelectedLevel1: string[];
}

const fmtCompactCurrency = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", notation: "compact", maximumFractionDigits: 1 }).format(n);

const formatPeriodLabel = (period: string) => {
  const [year, month] = period.split("-");
  const monthIndex = Number(month) - 1;
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return period;
  return `${monthNames[monthIndex]} ${year.slice(-2)}`;
};

const CHART_LABELS: Record<string, string> = {
  "Ventas": "Ventas",
  "Recursos Humanos": "RRHH",
  "Costos Directos": "Costos Dir.",
  "Gastos de Estructura": "Estructura",
  "Gastos de Estructura Tec": "Estructura Tec",
  "Gastos de Comercialización": "Comercial.",
  "Impuestos": "Impuestos",
  "EBITDA": "EBITDA",
};

type WaterfallKind = "total" | "positive" | "negative";
type WaterfallStep = { name: string; base: number; delta: number; raw: number; pct: number; kind: WaterfallKind };

const WATERFALL_COLORS: Record<WaterfallKind, string> = {
  total: "#0c7a5f",
  positive: "#7fc4ab",
  negative: "#c2410c",
};

const buildWaterfallSteps = (data: ExecutiveOverview): WaterfallStep[] => {
  const revenue = data.revenue.value;
  const pctOfRevenue = (v: number) => (revenue !== 0 ? (v / revenue) * 100 : 0);
  const operatingBranches = data.branches.filter((b) => b.group === "ingresos" || b.group === "gastos");

  const items: { name: string; value: number; total?: boolean }[] = [
    ...operatingBranches.map((b) => ({ name: CHART_LABELS[b.label] ?? b.label, value: b.total.value, total: b.group === "ingresos" })),
    { name: "EBITDA", value: data.ebitda.value, total: true },
  ];

  let running = 0;
  return items.map((item) => {
    if (item.total) {
      running = item.value;
      return { name: item.name, base: 0, delta: item.value, raw: item.value, pct: pctOfRevenue(item.value), kind: "total" as const };
    }
    const prev = running;
    running += item.value;
    const base = Math.min(prev, running);
    return {
      name: item.name,
      base,
      delta: Math.abs(item.value),
      raw: item.value,
      pct: pctOfRevenue(item.value),
      kind: (item.value >= 0 ? "positive" : "negative") as WaterfallKind,
    };
  });
};

const WaterfallTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: WaterfallStep }> }) => {
  if (!active || !payload?.length) return null;
  const step = payload[0].payload;
  return (
    <div style={{ background: "#fff", border: "1px solid #d9e2ec", borderRadius: 10, padding: "8px 12px", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{step.name}</div>
      <div>{fmtCurrency(step.raw)} ({fmtPct(step.pct)} s/ Ventas)</div>
    </div>
  );
};

interface StepLabelProps {
  x?: number;
  y?: number;
  width?: number;
  index?: number;
}

const MetricCell = ({ metric }: { metric: ExecutiveMetric }) => (
  <td style={{ textAlign: "right" }}>
    <div style={{ fontWeight: 600 }}>{fmtCurrency(metric.value)}</div>
    <div style={{ fontSize: 11, color: "var(--muted)" }}>{fmtPct(metric.pctRevenue)}</div>
  </td>
);

export function VisionEjecutivaTab({ data, loading, availableCostCenters, selectedCostCenters, onCostCentersChange, year, availableLevel1Dimensions, allPeriods, globalSelectedPeriods, globalSelectedLevel1 }: Props) {
  const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({});

  // Waterfall-local filters (pre-populated from global, independently editable)
  const [waterfallPeriods, setWaterfallPeriods] = useState<string[]>(globalSelectedPeriods);
  const [waterfallLevel1, setWaterfallLevel1] = useState<string[]>(globalSelectedLevel1);
  const initialised = useRef(false);
  useEffect(() => {
    if (!initialised.current) {
      initialised.current = true;
      setWaterfallPeriods(globalSelectedPeriods);
      setWaterfallLevel1(globalSelectedLevel1);
    }
  }, [globalSelectedPeriods, globalSelectedLevel1]);

  const [waterfallData, setWaterfallData] = useState<ExecutiveOverview | null>(null);
  const [waterfallLoading, setWaterfallLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ year });
    if (waterfallPeriods.length) params.set("periods", waterfallPeriods.join(","));
    if (waterfallLevel1.length) params.set("level1", waterfallLevel1.join(","));
    setWaterfallLoading(true);
    void fetch(`${apiBase}/api/executive-overview?${params}`)
      .then((r) => r.json())
      .then((d: ExecutiveOverview) => setWaterfallData(d))
      .finally(() => setWaterfallLoading(false));
  }, [year, waterfallPeriods, waterfallLevel1]);

  const ccSelector = (
    <label className="control-field control-field--multi" style={{ maxWidth: 280 }}>
      Centro de Costo
      <select
        className="multi-select"
        multiple
        size={3}
        value={selectedCostCenters}
        onChange={(e) => onCostCentersChange(Array.from(e.target.selectedOptions).map((opt) => opt.value))}
      >
        {availableCostCenters.map((cc) => (
          <option key={cc} value={cc}>{cc}</option>
        ))}
      </select>
      <span className="multi-select-meta">{selectedCostCenters.length} seleccionados</span>
    </label>
  );

  const clearAllFilters = () => {
    setWaterfallLevel1([]);
    setWaterfallPeriods([]);
    onCostCentersChange([]);
  };

  if (loading || !data) {
    return (
      <section className="table-card">
        <p>Cargando…</p>
      </section>
    );
  }

  const toggleBranch = (id: string) => setExpandedBranches((prev) => ({ ...prev, [id]: !prev[id] }));

  const hasAnyFilters = selectedCostCenters.length > 0 || waterfallPeriods.length > 0 || waterfallLevel1.length > 0;

  const wfSource = waterfallData ?? data;
  const steps = buildWaterfallSteps(wfSource);
  const renderStepLabel = (props: StepLabelProps) => {
    const { x = 0, y = 0, width = 0, index = 0 } = props;
    const step = steps[index];
    if (!step) return null;
    const cx = x + width / 2;
    const top = step.raw >= 0 ? y : y + 16;
    return (
      <g>
        <text x={cx} y={top - 18} textAnchor="middle" fontSize={12} fontWeight={700} fill="#132226">
          {fmtCompactCurrency(step.raw)}
        </text>
        <text x={cx} y={top - 4} textAnchor="middle" fontSize={10} fill="#4b6068">
          {fmtPct(step.pct)}
        </text>
      </g>
    );
  };

  const operatingBranches = data.branches.filter((b) => b.group === "ingresos" || b.group === "gastos");
  const belowLineBranches = data.branches.filter((b) => b.group === "belowLine");

  return (
    <>
      <div className="exec-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow">EBITDA del período · {data.periodLabel}</p>
          <h1>{fmtCurrency(data.ebitda.value)}</h1>
          <p className={data.ebitda.pctRevenue >= 0 ? "delta up" : "delta down"} style={{ fontSize: 16 }}>
            {fmtPct(data.ebitda.pctRevenue)} s/ Ventas
          </p>
          <p className="small">Resultado Neto (incl. one-time y financiero): {fmtCurrency(data.netResult.value)} ({fmtPct(data.netResult.pctRevenue)} s/ Ventas)</p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {ccSelector}
          {hasAnyFilters && (
            <button
              type="button"
              style={{
                padding: "8px 16px",
                backgroundColor: "#f87171",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
                height: "fit-content",
                alignSelf: "flex-end",
              }}
              onClick={clearAllFilters}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <section className="table-card">
        <h2>Estado de Resultados</h2>
        <p className="small">Abierto según el árbol del plan de cuentas. Click en una fila con ▸ para ver el detalle de cuentas.</p>
        <div className="drill-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                {data.periods.map((p) => <th key={p} style={{ textAlign: "right" }}>{formatPeriodLabel(p)}</th>)}
                {data.periods.length > 1 && <th style={{ textAlign: "right", borderLeft: "2px solid var(--ink)" }}>Total</th>}
              </tr>
            </thead>
            <tbody>
              {operatingBranches.map((b) => (
                <Fragment key={b.id}>
                  <tr className={b.group === "ingresos" ? "subtotal-row" : "detail-row"}>
                    <td className="concept-cell" style={{ paddingLeft: 12 }}>
                      {b.accounts.length > 0 ? (
                        <button type="button" className="tree-toggle" onClick={() => toggleBranch(b.id)} aria-label={expandedBranches[b.id] ? `Contraer ${b.label}` : `Expandir ${b.label}`}>
                          {expandedBranches[b.id] ? "▾" : "▸"}
                        </button>
                      ) : (
                        <span className="tree-toggle-spacer" />
                      )}
                      {b.label}
                    </td>
                    {data.periods.map((p) => <MetricCell key={p} metric={b.byPeriod[p]} />)}
                    {data.periods.length > 1 && <td style={{ textAlign: "right", borderLeft: "2px solid var(--ink)" }}><div style={{ fontWeight: 600 }}>{fmtCurrency(b.total.value)}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{fmtPct(b.total.pctRevenue)}</div></td>}
                  </tr>
                  {expandedBranches[b.id] ? b.accounts.map((a) => (
                    <tr key={`${b.id}-${a.account}`} className="detail-row">
                      <td className="concept-cell" style={{ paddingLeft: 42, fontWeight: 400, color: "var(--muted)" }}>{a.account}</td>
                      {data.periods.map((p) => (
                        <td key={p} style={{ textAlign: "right", color: "var(--muted)" }}>{fmtCurrency(a.byPeriod[p])}</td>
                      ))}
                      {data.periods.length > 1 && <td style={{ textAlign: "right", color: "var(--muted)", borderLeft: "2px solid var(--ink)" }}>{fmtCurrency(a.total)}</td>}
                    </tr>
                  )) : null}
                </Fragment>
              ))}
              <tr className="kpi-row" style={{ borderTop: "2px solid var(--ink)" }}>
                <td className="concept-cell" style={{ paddingLeft: 12 }}>EBITDA</td>
                {data.periods.map((p) => <MetricCell key={p} metric={data.ebitdaByPeriod[p]} />)}
                {data.periods.length > 1 && <td style={{ textAlign: "right", borderLeft: "2px solid var(--ink)" }}><div style={{ fontWeight: 600 }}>{fmtCurrency(data.ebitda.value)}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{fmtPct(data.ebitda.pctRevenue)}</div></td>}
              </tr>
              {belowLineBranches.map((b) => (
                <Fragment key={b.id}>
                  <tr className="detail-row">
                    <td className="concept-cell" style={{ paddingLeft: 12, fontWeight: 400, fontStyle: "italic", color: "var(--muted)" }}>
                      {b.accounts.length > 0 ? (
                        <button type="button" className="tree-toggle" onClick={() => toggleBranch(b.id)} aria-label={expandedBranches[b.id] ? `Contraer ${b.label}` : `Expandir ${b.label}`}>
                          {expandedBranches[b.id] ? "▾" : "▸"}
                        </button>
                      ) : (
                        <span className="tree-toggle-spacer" />
                      )}
                      {b.label} <span className="info-icon" title="Fuera del resultado operativo (EBITDA)">ⓘ</span>
                    </td>
                    {data.periods.map((p) => (
                      <td key={p} style={{ textAlign: "right", color: "var(--muted)" }}>
                        <div>{fmtCurrency(b.byPeriod[p]?.value ?? 0)}</div>
                        <div style={{ fontSize: 11 }}>{fmtPct(b.byPeriod[p]?.pctRevenue ?? 0)}</div>
                      </td>
                    ))}
                    {data.periods.length > 1 && <td style={{ textAlign: "right", color: "var(--muted)", borderLeft: "2px solid var(--ink)" }}><div>{fmtCurrency(b.total.value)}</div><div style={{ fontSize: 11 }}>{fmtPct(b.total.pctRevenue)}</div></td>}
                  </tr>
                  {expandedBranches[b.id] ? b.accounts.map((a) => (
                    <tr key={`${b.id}-${a.account}`} className="detail-row">
                      <td className="concept-cell" style={{ paddingLeft: 42, fontWeight: 400, color: "var(--muted)" }}>{a.account}</td>
                      {data.periods.map((p) => (
                        <td key={p} style={{ textAlign: "right", color: "var(--muted)" }}>{fmtCurrency(a.byPeriod[p])}</td>
                      ))}
                      {data.periods.length > 1 && <td style={{ textAlign: "right", color: "var(--muted)", borderLeft: "2px solid var(--ink)" }}>{fmtCurrency(a.total)}</td>}
                    </tr>
                  )) : null}
                </Fragment>
              ))}
              <tr className="kpi-row" style={{ borderTop: "2px solid var(--ink)" }}>
                <td className="concept-cell" style={{ paddingLeft: 12 }}>Totales (Resultado Neto)</td>
                {data.periods.map((p) => <MetricCell key={p} metric={data.netResultByPeriod[p]} />)}
                {data.periods.length > 1 && <td style={{ textAlign: "right", borderLeft: "2px solid var(--ink)" }}><div style={{ fontWeight: 600 }}>{fmtCurrency(data.netResult.value)}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{fmtPct(data.netResult.pctRevenue)}</div></td>}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="chart-card">
        <h2>Cascada Ventas → EBITDA</h2>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, alignItems: "flex-start" }}>
          <label className="control-field control-field--multi" style={{ maxWidth: 220 }}>
            Período
            <select
              className="multi-select"
              multiple
              size={3}
              value={waterfallPeriods}
              onChange={(e) => setWaterfallPeriods(Array.from(e.target.selectedOptions).map((o) => o.value))}
            >
              {allPeriods.map((p) => (
                <option key={p} value={p}>{formatPeriodLabel(p)}</option>
              ))}
            </select>
            <span className="multi-select-meta">{waterfallPeriods.length ? `${waterfallPeriods.length} seleccionado/s` : "Todos los períodos"}</span>
          </label>

          <label className="control-field control-field--multi" style={{ maxWidth: 220 }}>
            Nivel 1 Dimensión
            <select
              className="multi-select"
              multiple
              size={3}
              value={waterfallLevel1}
              onChange={(e) => setWaterfallLevel1(Array.from(e.target.selectedOptions).map((o) => o.value))}
            >
              {availableLevel1Dimensions.map((dim) => (
                <option key={dim} value={dim}>{dim}</option>
              ))}
            </select>
            <span className="multi-select-meta">{waterfallLevel1.length ? `${waterfallLevel1.length} seleccionado/s` : "Todas las dimensiones"}</span>
          </label>
        </div>

        {(() => {
          const wfData = waterfallData ?? data;
          if (!wfData) return null;
          return (
            <p className="small">
              {waterfallLoading ? "Actualizando…" : `Suma de ${wfData.periods.length > 1 ? `los ${wfData.periods.length} períodos` : "el período"} (${wfData.periodLabel})${waterfallLevel1.length ? ` · ${waterfallLevel1.join(", ")}` : ""}.`}
            </p>
          );
        })()}

        <div className="chart-wrap" style={{ height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={steps} margin={{ top: 32, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis width={72} tickFormatter={(value) => fmtCompactCurrency(Number(value))} tick={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#132226" strokeWidth={1} />
              <Tooltip content={<WaterfallTooltip />} />
              <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="delta" stackId="wf" isAnimationActive={false}>
                {steps.map((step) => (
                  <Cell
                    key={step.name}
                    fill={WATERFALL_COLORS[step.kind]}
                    stroke={step.name === "EBITDA" ? "#132226" : undefined}
                    strokeWidth={step.name === "EBITDA" ? 2 : undefined}
                  />
                ))}
                <LabelList dataKey="delta" content={renderStepLabel as any} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="financial-note">
          <span className="eyebrow">Fuera del resultado operativo</span>
          {wfSource.branches.filter((b) => b.group === "belowLine").map((b) => (
            <p key={b.id} style={{ margin: "4px 0 0" }}>
              {b.label}: <strong>{fmtCurrency(b.total.value)}</strong> ({fmtPct(b.total.pctRevenue)} s/ Ventas)
            </p>
          ))}
        </div>
      </section>
    </>
  );
}
