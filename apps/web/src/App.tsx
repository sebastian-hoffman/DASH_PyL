import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { VisionEjecutivaTab, type ExecutiveOverview } from "./tabs/VisionEjecutivaTab";
import { FileUploadModal } from "./components/FileUploadModal";
import { DataImportModal } from "./components/DataImportModal";
import { ImportHistory } from "./components/ImportHistory";

type Kpi = { title: string; value: number; deltaPct: number };
type ChartPoint = { month: string; habitual: number };
type RevenueChartPoint = { month: string; total: number; [dimension: string]: string | number };
type RevenueChartResponse = { dimensions: string[]; rows: RevenueChartPoint[] };
type PnlRow = {
  id: string; label: string; level: number;
  kind: "section" | "detail" | "subtotal" | "kpi";
  month: number; quarter: number; ytd: number; hasAdjustments: boolean;
};
type DrillRow = {
  id: string; date: string; document: string; account: string;
  costCenter: string; detail: string; amount: number; adjustedAmount: number;
};
type BreakdownMetric = { months: number[]; ytd: number };
type BreakdownRow = {
  group: string;
  ventas: BreakdownMetric; costoVentas: BreakdownMetric;
  margenBruto: BreakdownMetric; gastosOp: BreakdownMetric; ebitda: BreakdownMetric;
};
type BreakdownResponse = {
  periods: { month: string; quarter: string; ytd: string };
  monthLabels: string[]; rows: BreakdownRow[];
};
type BuMatrixRow = {
  id: string;
  label: string;
  level: number;
  kind: "section" | "detail" | "subtotal" | "kpi";
  values: Record<string, number>;
  total: number;
};
type BuMatrixResponse = {
  scope: "month" | "quarter" | "ytd";
  section: "habitual" | "especiales" | "all";
  columns: string[];
  rows: BuMatrixRow[];
};
type UnitPnlResponse = {
  periods: { month: string; quarter: string; ytd: string };
  unit: string; rows: PnlRow[];
};
type UnitCcBreakdownRow = {
  costCenter: string;
  ventas: BreakdownMetric;
  costoVentas: BreakdownMetric;
  margenBruto: BreakdownMetric;
  gastosOp: BreakdownMetric;
  ebitda: BreakdownMetric;
};
type UnitCcBreakdownResponse = {
  unit: string;
  periods: { month: string; quarter: string; ytd: string };
  monthLabels: string[];
  rows: UnitCcBreakdownRow[];
};
type UnitCcMatrixRow = {
  id: string;
  label: string;
  level: number;
  kind: "section" | "detail" | "subtotal" | "kpi";
  values: Record<string, number>;
  total: number;
};
type UnitCcMatrixResponse = {
  unit: string;
  scope: "month" | "quarter" | "ytd";
  section: "habitual" | "especiales" | "all";
  columns: string[];
  rows: UnitCcMatrixRow[];
};
type AdjustmentOptions = {
  accounts: string[];
  costCenters: string[];
  periods: string[];
};
type SavedAdjustment = {
  id: string;
  kind: "reclassification" | "result_impact";
  amount: number;
  debit: { account: string; costCenter: string; period: string };
  credit: { account: string; costCenter: string; period: string };
  note: string;
  referenceLineId?: string;
  createdAt: string;
};
type PeriodOption = { period: string; quarter: string };
type DrillScope = "month" | "quarter" | "ytd" | "selected";

// Drill panel state: null → showing nothing | "dim" → showing by-dim list | "cc" → showing cc list | "movements" → showing rows
type DimDrillState =
  | null
  | { mode: "dim"; lineId: string; rows: { group: string; total: number }[] }
  | { mode: "cc"; lineId: string; dim: string; rows: { costCenter: string; total: number }[] }
  | { mode: "movements"; lineId: string; dim: string; cc: string; rows: DrillRow[] };

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const fmtCompactNumber = (n: number) =>
  new Intl.NumberFormat("es-AR", { notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 }).format(n);
const revenuePalette = ["#0f766e", "#1d4ed8", "#c2410c", "#7c3aed", "#ca8a04", "#64748b"];

const formatPeriodLabel = (period: string) => {
  const [year, month] = period.split("-");
  const monthIndex = Number(month) - 1;
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return period;
  return `${monthNames[monthIndex]} ${year.slice(-2)}`;
};

const RevenueTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ color?: string; dataKey?: string | number; name?: string; value?: number }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  const totalEntry = payload.find((entry) => entry.dataKey === "total");
  const dimensionEntries = payload
    .filter((entry) => entry.dataKey !== "total" && typeof entry.value === "number" && entry.value !== 0)
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0));

  return (
    <div style={{ background: "#fff", border: "1px solid #d9e2ec", borderRadius: 10, padding: 12, boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{label}</div>
      {typeof totalEntry?.value === "number" ? <div style={{ marginBottom: 8 }}>Total: {fmtCurrency(totalEntry.value)}</div> : null}
      {dimensionEntries.map((entry) => (
        <div key={String(entry.dataKey)} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: entry.color ?? "#94a3b8", display: "inline-block" }} />
          <span>{entry.name}: {fmtCurrency(entry.value ?? 0)}</span>
        </div>
      ))}
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "vision-ejecutiva" | "analisis" | "cc-explorer" | "importaciones">("dashboard");
  const [year, setYear] = useState<"2025" | "2026">("2025");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [savedAdjustments, setSavedAdjustments] = useState<SavedAdjustment[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [revenueChart, setRevenueChart] = useState<RevenueChartResponse>({ dimensions: [], rows: [] });
  const [rows, setRows] = useState<PnlRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEspeciales, setShowEspeciales] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsedConceptIds, setCollapsedConceptIds] = useState<Record<string, boolean>>({});
  const [availableLevel1Dimensions, setAvailableLevel1Dimensions] = useState<string[]>([]);
  const [selectedLevel1Dimensions, setSelectedLevel1Dimensions] = useState<string[]>([]);
  const [selectedFilterPeriods, setSelectedFilterPeriods] = useState<string[]>([]);

  // Visión Ejecutiva
  const [executiveOverview, setExecutiveOverview] = useState<ExecutiveOverview | null>(null);
  const [executiveLoading, setExecutiveLoading] = useState(true);
  const [availableCostCenters, setAvailableCostCenters] = useState<string[]>([]);
  const [selectedCostCenters, setSelectedCostCenters] = useState<string[]>([]);

  // Period selector
  const [allPeriods, setAllPeriods] = useState<PeriodOption[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [showMonthColumns, setShowMonthColumns] = useState(true);
  const [showQuarterColumn, setShowQuarterColumn] = useState(true);

  // Drilldown state (dim → cc → movements)
  const [dimDrill, setDimDrill] = useState<DimDrillState>(null);
  const [drillLabel, setDrillLabel] = useState("");
  const [drillScope, setDrillScope] = useState<DrillScope>("ytd");

  // Adjustment panel
  const [adjLineId, setAdjLineId] = useState<string | null>(null);
  const [adjLineLabel, setAdjLineLabel] = useState("");
  const [adjKind, setAdjKind] = useState<"reclassification" | "result_impact">("reclassification");
  const [adjAmount, setAdjAmount] = useState<number>(0);
  const [adjDebitAccount, setAdjDebitAccount] = useState("");
  const [adjDebitCC, setAdjDebitCC] = useState("");
  const [adjDebitPeriod, setAdjDebitPeriod] = useState("");
  const [adjCreditAccount, setAdjCreditAccount] = useState("");
  const [adjCreditCC, setAdjCreditCC] = useState("");
  const [adjCreditPeriod, setAdjCreditPeriod] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjMsg, setAdjMsg] = useState("");
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<string | null>(null);
  const [adjOptions, setAdjOptions] = useState<AdjustmentOptions>({ accounts: [], costCenters: [], periods: [] });

  // Breakdown
  const [groupBy, setGroupBy] = useState<"bu" | "vertical" | "area" | "cc">("bu");
  const [breakSection, setBreakSection] = useState<"habitual" | "especiales" | "all">("habitual");
  const [breakMetric, setBreakMetric] = useState<"ventas" | "margenBruto" | "ebitda">("ebitda");
  const [breakdown, setBreakdown] = useState<BreakdownResponse | null>(null);
  const [unitPnl, setUnitPnl] = useState<UnitPnlResponse | null>(null);
  const [buMatrixScope, setBuMatrixScope] = useState<"month" | "quarter" | "ytd">("ytd");
  const [buMatrixSection, setBuMatrixSection] = useState<"habitual" | "especiales" | "all">("habitual");
  const [buMatrix, setBuMatrix] = useState<BuMatrixResponse | null>(null);
  const [breakShowMonths, setBreakShowMonths] = useState(true);
  const [breakShowQuarter, setBreakShowQuarter] = useState(false);
  const [breakShowYtd, setBreakShowYtd] = useState(true);
  const [unitCcBreakdown, setUnitCcBreakdown] = useState<UnitCcBreakdownResponse | null>(null);
  const [unitCcMetric, setUnitCcMetric] = useState<"ventas" | "margenBruto" | "ebitda">("ebitda");
  const [unitCcMatrix, setUnitCcMatrix] = useState<UnitCcMatrixResponse | null>(null);
  const [unitCcMatrixOpen, setUnitCcMatrixOpen] = useState(false);
  const [unitCcMatrixScope, setUnitCcMatrixScope] = useState<"month" | "quarter" | "ytd">("ytd");
  const [unitContextGroup, setUnitContextGroup] = useState<string | null>(null);
  const [unitContextSection, setUnitContextSection] = useState<"habitual" | "especiales" | "all">("habitual");

  // CC Explorer
  type CcExplorerRow = { account: string; level2: string; level3: string; total: number };
  type CcExplorerResult = { cc: string; periods: string[]; grandTotal: number; rows: CcExplorerRow[]; availableCCs: string[] };
  const [ccExplorerCC, setCcExplorerCC] = useState("");
  const [ccExplorerPeriod, setCcExplorerPeriod] = useState("");
  const [ccExplorerResult, setCcExplorerResult] = useState<CcExplorerResult | null>(null);
  const [ccExplorerLoading, setCcExplorerLoading] = useState(false);
  const [ccAvailable, setCcAvailable] = useState<string[]>([]);

  const inputFilesByYear: Record<"2025" | "2026", string> = {
    "2025": "Perdidas y ganancias.xlsx",
    "2026": "PyG_2026_05.xlsx",
  };

  const level1Param = useMemo(() => selectedLevel1Dimensions.join(","), [selectedLevel1Dimensions]);
  const periodFilterParam = useMemo(() => selectedFilterPeriods.join(","), [selectedFilterPeriods]);
  const costCenterParam = useMemo(() => selectedCostCenters.join(","), [selectedCostCenters]);

  const appendLevel1Filter = (params: URLSearchParams) => {
    if (level1Param) params.set("level1", level1Param);
    return params;
  };

  const appendGlobalDataFilters = (params: URLSearchParams) => {
    appendLevel1Filter(params);
    if (periodFilterParam) params.set("periods", periodFilterParam);
    return params;
  };

  const runCcExplorer = async () => {
    if (!ccExplorerCC.trim()) return;
    setCcExplorerLoading(true);
    const params = appendLevel1Filter(new URLSearchParams({ cc: ccExplorerCC.trim(), year }));
    if (periodFilterParam) params.set("filterPeriods", periodFilterParam);
    if (ccExplorerPeriod.trim()) params.set("periods", ccExplorerPeriod.trim());
    const data: CcExplorerResult = await fetch(`${apiBase}/api/cc-explorer?${params}`).then((r) => r.json());
    setCcExplorerResult(data);
    if (data.availableCCs?.length) setCcAvailable(data.availableCCs);
    setCcExplorerLoading(false);
  };

  // Load available periods for active year
  useEffect(() => {
    const params = appendLevel1Filter(new URLSearchParams({ year }));
    void fetch(`${apiBase}/api/periods?${params}`).then((r) => r.json()).then((d) => {
      const opts: PeriodOption[] = d.periods || [];
      setAllPeriods(opts);
      setAvailableLevel1Dimensions(d.level1Dimensions || []);
      setSelectedLevel1Dimensions((prev) => prev.filter((dim) => (d.level1Dimensions || []).includes(dim)));
      setSelectedFilterPeriods((prev) => prev.filter((p) => opts.some((o) => o.period === p)));
      setAvailableCostCenters(d.costCenters || []);
      setSelectedCostCenters((prev) => prev.filter((cc) => (d.costCenters || []).includes(cc)));
      // default: last 3 months
      const last3 = opts.slice(-3).map((o) => o.period);
      setSelectedPeriods(last3);
    });
  }, [year, level1Param]);

  // Load P&L and overview
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [o, p] = await Promise.all([
          fetch(`${apiBase}/api/overview?${appendGlobalDataFilters(new URLSearchParams({ year }))}`).then((r) => r.json()),
          fetch(`${apiBase}/api/pnl?${appendGlobalDataFilters(new URLSearchParams({ year }))}`).then((r) => r.json())
        ]);
        setKpis(o.kpis || []);
        setChart(o.chart || []);
        setRevenueChart(o.revenueChart || { dimensions: [], rows: [] });
        setRows(p.rows || []);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [year, level1Param, periodFilterParam]);

  // Load Visión Ejecutiva
  useEffect(() => {
    const load = async () => {
      setExecutiveLoading(true);
      try {
        const params = appendGlobalDataFilters(new URLSearchParams({ year }));
        if (costCenterParam) params.set("cc", costCenterParam);
        const data: ExecutiveOverview = await fetch(`${apiBase}/api/executive-overview?${params}`).then((r) => r.json());
        setExecutiveOverview(data);
      } finally {
        setExecutiveLoading(false);
      }
    };
    void load();
  }, [year, level1Param, periodFilterParam, costCenterParam]);

  useEffect(() => {
    void fetch(`${apiBase}/api/adjustment-options`)
      .then((r) => r.json())
      .then((d) => {
        setAdjOptions({
          accounts: d.accounts || [],
          costCenters: d.costCenters || [],
          periods: d.periods || []
        });
      });
  }, []);

  const loadSavedAdjustments = () => {
    void fetch(`${apiBase}/api/adjustments`)
      .then((r) => r.json())
      .then((d) => setSavedAdjustments(d.adjustments || []));
  };

  const resetAdjustmentForm = () => {
    setEditingAdjustmentId(null);
    setAdjLineId(null);
    setAdjLineLabel("");
    setAdjKind("reclassification");
    setAdjAmount(0);
    setAdjDebitAccount("");
    setAdjDebitCC("");
    setAdjDebitPeriod("");
    setAdjCreditAccount("");
    setAdjCreditCC("");
    setAdjCreditPeriod("");
    setAdjNote("");
  };

  const startEditingAdjustment = (adjustment: SavedAdjustment) => {
    setEditingAdjustmentId(adjustment.id);
    setAdjLineId(adjustment.referenceLineId ?? null);
    setAdjLineLabel(rows.find((row) => row.id === adjustment.referenceLineId)?.label ?? adjustment.referenceLineId ?? "");
    setAdjKind(adjustment.kind);
    setAdjAmount(adjustment.amount);
    setAdjDebitAccount(adjustment.debit.account);
    setAdjDebitCC(adjustment.debit.costCenter);
    setAdjDebitPeriod(adjustment.debit.period);
    setAdjCreditAccount(adjustment.credit.account);
    setAdjCreditCC(adjustment.credit.costCenter);
    setAdjCreditPeriod(adjustment.credit.period);
    setAdjNote(adjustment.note);
    setAdjMsg(`Editando ajuste del ${new Date(adjustment.createdAt).toLocaleDateString("es-AR")}.`);
    // setActiveTab("ajustes"); // DISABLED
  };

  // DISABLED: useEffect(() => {
  //   if (activeTab === "ajustes") loadSavedAdjustments();
  // }, [activeTab]);

  // Load breakdown
  useEffect(() => {
    void fetch(`${apiBase}/api/pnl-breakdown?${appendGlobalDataFilters(new URLSearchParams({ groupBy, section: breakSection, year }))}`)
      .then((r) => r.json()).then(setBreakdown);
  }, [groupBy, breakSection, year, level1Param, periodFilterParam]);

  useEffect(() => {
    void fetch(`${apiBase}/api/pnl-bu-matrix?${appendGlobalDataFilters(new URLSearchParams({ scope: buMatrixScope, section: buMatrixSection, year }))}`)
      .then((r) => r.json())
      .then(setBuMatrix);
  }, [buMatrixScope, buMatrixSection, year, level1Param, periodFilterParam]);

  const effectivePeriods = useMemo(() => {
    if (selectedPeriods.length > 0) {
      return selectedPeriods;
    }
    return allPeriods.map((o) => o.period);
  }, [allPeriods, selectedPeriods]);

  const colPeriods = useMemo(() => {
    if (!showMonthColumns) {
      return [] as PeriodOption[];
    }
    return allPeriods.filter((o) => effectivePeriods.includes(o.period));
  }, [allPeriods, effectivePeriods, showMonthColumns]);

  const drillPeriods = useMemo(() => {
    if (!allPeriods.length) return effectivePeriods;

    const sorted = [...allPeriods].sort((a, b) => a.period.localeCompare(b.period));
    const current = sorted[sorted.length - 1];
    if (!current) return effectivePeriods;

    if (drillScope === "selected") {
      return effectivePeriods;
    }

    if (drillScope === "month") {
      return [current.period];
    }

    if (drillScope === "quarter") {
      return sorted.filter((p) => p.quarter === current.quarter).map((p) => p.period);
    }

    const year = current.period.split("-")[0];
    return sorted.filter((p) => p.period.startsWith(`${year}-`) && p.period <= current.period).map((p) => p.period);
  }, [allPeriods, drillScope, effectivePeriods]);

  const drillPeriodParam = drillPeriods.join(",");

  const drillScopeLabel = useMemo(() => {
    if (drillScope === "month") return "Total mes";
    if (drillScope === "quarter") return "Total trimestre";
    if (drillScope === "selected") return "Total períodos seleccionados";
    return "Total YTD";
  }, [drillScope]);

  const breakdownMonthColumns = useMemo(() => {
    const labels = breakdown?.monthLabels || [];
    if (!labels.length) return [] as { label: string; idx: number }[];
    const sourcePeriods = selectedPeriods.length > 0 ? selectedPeriods : labels;
    const selectedSet = new Set(sourcePeriods);
    return labels
      .map((label, idx) => ({ label, idx }))
      .filter((item) => selectedSet.has(item.label));
  }, [breakdown?.monthLabels, selectedPeriods]);

  const breakdownQuarterLabels = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const col of breakdownMonthColumns) {
      const [year, monthStr] = col.label.split("-");
      const month = Number(monthStr);
      if (!year || Number.isNaN(month)) continue;
      const quarter = `Q${Math.floor((month - 1) / 3) + 1}`;
      map.set(`${year}-${quarter}`, true);
    }
    return [...map.keys()].sort();
  }, [breakdownMonthColumns]);

  const getQuarterValue = (months: number[], quarterKey: string) => {
    const [year, quarter] = quarterKey.split("-");
    let total = 0;
    for (const col of breakdownMonthColumns) {
      const [labelYear, monthStr] = col.label.split("-");
      const month = Number(monthStr);
      if (labelYear !== year || Number.isNaN(month)) continue;
      const q = `Q${Math.floor((month - 1) / 3) + 1}`;
      if (q === quarter) total += months[col.idx] || 0;
    }
    return total;
  };

  const togglePeriod = (p: string) => {
    setSelectedPeriods((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort()
    );
  };

  const filteredRows = useMemo(() => {
    const visible = rows.filter((r) => {
      if (!showEspeciales && r.label.toLowerCase().includes("servicios especiales")) return false;
      if (search.trim()) return r.label.toLowerCase().includes(search.trim().toLowerCase());
      return true;
    });

    if (showEspeciales) {
      return visible;
    }

    // If specials are hidden, keep net result consistent with habitual-only view.
    const seEbitda = rows.find((r) => r.id === "se-ebitda");
    if (!seEbitda) {
      return visible;
    }

    return visible.map((r) => {
      if (r.id !== "net") {
        return r;
      }
      return {
        ...r,
        month: r.month - seEbitda.month,
        quarter: r.quarter - seEbitda.quarter,
        ytd: r.ytd - seEbitda.ytd
      };
    });
  }, [rows, showEspeciales, search]);

  const conceptHierarchy = useMemo(() => {
    const childCount = new Map<string, number>();
    const stack: Array<{ id: string; level: number }> = [];

    for (const row of filteredRows) {
      while (stack.length && stack[stack.length - 1].level >= row.level) {
        stack.pop();
      }
      if (stack.length) {
        const parentId = stack[stack.length - 1].id;
        childCount.set(parentId, (childCount.get(parentId) ?? 0) + 1);
      }
      stack.push({ id: row.id, level: row.level });
    }

    return { childCount };
  }, [filteredRows]);

  const visiblePnlRows = useMemo(() => {
    const visible: PnlRow[] = [];
    const collapsedLevels: number[] = [];

    for (const row of filteredRows) {
      while (collapsedLevels.length && row.level <= collapsedLevels[collapsedLevels.length - 1]) {
        collapsedLevels.pop();
      }

      if (collapsedLevels.length) {
        if ((conceptHierarchy.childCount.get(row.id) ?? 0) > 0 && collapsedConceptIds[row.id]) {
          collapsedLevels.push(row.level);
        }
        continue;
      }

      visible.push(row);
      if ((conceptHierarchy.childCount.get(row.id) ?? 0) > 0 && collapsedConceptIds[row.id]) {
        collapsedLevels.push(row.level);
      }
    }

    return visible;
  }, [filteredRows, conceptHierarchy.childCount, collapsedConceptIds]);

  const toggleConcept = (id: string) => {
    setCollapsedConceptIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const collapseAllConcepts = () => {
    const next: Record<string, boolean> = {};
    for (const row of filteredRows) {
      if ((conceptHierarchy.childCount.get(row.id) ?? 0) > 0) {
        next[row.id] = true;
      }
    }
    setCollapsedConceptIds(next);
  };

  const expandAllConcepts = () => {
    setCollapsedConceptIds({});
  };

  // Gets the amount for a P&L row for a specific period from source
  // We use month/quarter/ytd from existing rows but for selected periods we call drill endpoint
  // For simplicity: the P&L table shows the aggregated "month" (last period), "quarter", "ytd" as before,
  // but user can also see additional custom period columns via the period selector.
  // The custom columns are fetched via /api/pnl-dim-drill at the full line level.
  // We store them in a map: lineId → period → total
  const [lineAmounts, setLineAmounts] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    if (!showMonthColumns || !effectivePeriods.length) {
      setLineAmounts({});
      return;
    }
    // Fetch aggregated amounts per line for each selected period via drilldown
    // We batch: for each period separately fetch and sum for all lines
    const lines = rows
      .filter((r) => r.kind !== "section")
      .map((r) => r.id);
    const newAmounts: Record<string, Record<string, number>> = {};
    const fetches = lines.flatMap((lineId) =>
      effectivePeriods.map(async (period) => {
        const params = appendLevel1Filter(new URLSearchParams({
          lineId,
          periods: period,
          year,
        }));
        if (periodFilterParam) params.set("filterPeriods", periodFilterParam);
        const res = await fetch(`${apiBase}/api/pnl-dim-drill?${params}`).then((r) => r.json());
        if (!newAmounts[lineId]) newAmounts[lineId] = {};
        const total = (res.rows || []).reduce((s: number, row: { total: number }) => s + row.total, 0);
        newAmounts[lineId][period] = total;
      })
    );
    void Promise.all(fetches).then(() => setLineAmounts({ ...newAmounts }));
  }, [effectivePeriods, rows, showMonthColumns, year, level1Param, periodFilterParam]);

  // Dim drill: open first level (Nivel 1 dimensión) for a P&L line
  const openDimDrill = async (row: PnlRow) => {
    setAdjLineId(row.id);
    setAdjLineLabel(row.label);
    setDrillLabel(row.label);
    const params = appendLevel1Filter(new URLSearchParams({
      lineId: row.id,
      periods: drillPeriodParam,
      year,
    }));
    if (periodFilterParam) params.set("filterPeriods", periodFilterParam);
    const res = await fetch(`${apiBase}/api/pnl-dim-drill?${params}`).then((r) => r.json());
    if (res.rows?.length) {
      setDimDrill({ mode: "dim", lineId: row.id, rows: res.rows });
    } else {
      setDimDrill({ mode: "dim", lineId: row.id, rows: [] });
    }
  };

  // Second level: click on a dim group → opens CC list
  const openCcDrill = async (lineId: string, dim: string) => {
    const params = appendLevel1Filter(new URLSearchParams({
      lineId,
      dim,
      periods: drillPeriodParam,
      year,
    }));
    if (periodFilterParam) params.set("filterPeriods", periodFilterParam);
    const res = await fetch(`${apiBase}/api/pnl-dim-drill?${params}`).then((r) => r.json());
    setDimDrill({ mode: "cc", lineId, dim, rows: res.rows || [] });
  };

  // Third level: click on CC → opens movements
  const openMovements = async (lineId: string, dim: string, cc: string) => {
    const params = appendLevel1Filter(new URLSearchParams({
      lineId,
      dim,
      cc,
      periods: drillPeriodParam,
      year,
    }));
    if (periodFilterParam) params.set("filterPeriods", periodFilterParam);
    const res = await fetch(`${apiBase}/api/pnl-dim-drill?${params}`).then((r) => r.json());
    setDimDrill({ mode: "movements", lineId, dim, cc, rows: res.rows || [] });
  };

  const onSaveAdjustment = async () => {
    if (
      adjAmount <= 0 ||
      adjNote.trim().length < 3 ||
      !adjDebitAccount.trim() ||
      !adjDebitCC.trim() ||
      !adjDebitPeriod.trim() ||
      !adjCreditAccount.trim() ||
      !adjCreditCC.trim() ||
      !adjCreditPeriod.trim()
    ) {
      setAdjMsg("Completá monto, nota y datos de debe/haber (cuenta, centro y período).");
      return;
    }

    const res = await fetch(editingAdjustmentId ? `${apiBase}/api/adjustments/${editingAdjustmentId}` : `${apiBase}/api/adjustments`, {
      method: editingAdjustmentId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: adjKind,
        amount: Math.abs(adjAmount),
        debit: {
          account: adjDebitAccount.trim(),
          costCenter: adjDebitCC.trim(),
          period: adjDebitPeriod.trim()
        },
        credit: {
          account: adjCreditAccount.trim(),
          costCenter: adjCreditCC.trim(),
          period: adjCreditPeriod.trim()
        },
        note: adjNote.trim(),
        referenceLineId: adjLineId || undefined
      })
    });

    if (res.ok) {
      setAdjMsg(editingAdjustmentId ? "Ajuste actualizado correctamente." : "Ajuste guardado correctamente.");
      const p = await fetch(`${apiBase}/api/pnl?${appendGlobalDataFilters(new URLSearchParams({ year }))}`).then((r) => r.json());
      setRows(p.rows || []);
      loadSavedAdjustments();
      resetAdjustmentForm();
    } else {
      setAdjMsg(editingAdjustmentId
        ? "No se pudo actualizar el ajuste. Revisá campos y formato de período (YYYY-MM)."
        : "No se pudo guardar el ajuste. Revisá campos y formato de período (YYYY-MM).");
    }
  };

  const onDeleteAdjustment = async (adjustment: SavedAdjustment) => {
    if (!window.confirm(`Eliminar ajuste por ${fmtCurrency(adjustment.amount)}?`)) {
      return;
    }

    const res = await fetch(`${apiBase}/api/adjustments/${adjustment.id}`, {
      method: "DELETE"
    });

    if (!res.ok) {
      setAdjMsg("No se pudo eliminar el ajuste.");
      return;
    }

    if (editingAdjustmentId === adjustment.id) {
      resetAdjustmentForm();
    }

    const p = await fetch(`${apiBase}/api/pnl?${appendGlobalDataFilters(new URLSearchParams({ year }))}`).then((r) => r.json());
    setRows(p.rows || []);
    loadSavedAdjustments();
    setAdjMsg("Ajuste eliminado correctamente.");
  };

  const onOpenUnit = async (group: string, sectionOverride?: "habitual" | "especiales" | "all") => {
    const sectionForUnit = sectionOverride || breakSection;
    const data = await fetch(
      `${apiBase}/api/pnl-unit?${new URLSearchParams({
        groupBy,
        group,
        section: sectionForUnit,
        year,
        ...(level1Param ? { level1: level1Param } : {}),
        ...(periodFilterParam ? { periods: periodFilterParam } : {}),
      })}`
    ).then((r) => r.json());
    setUnitPnl(data);
    setUnitContextGroup(group);
    setUnitContextSection(sectionForUnit);
    setUnitCcMatrixOpen(false);
    setUnitCcMatrix(null);

    const ccData = await fetch(
      `${apiBase}/api/pnl-unit-cc-breakdown?${new URLSearchParams({
        groupBy,
        group,
        section: sectionForUnit,
        year,
        ...(level1Param ? { level1: level1Param } : {}),
        ...(periodFilterParam ? { periods: periodFilterParam } : {}),
      })}`
    ).then((r) => r.json());
    setUnitCcBreakdown(ccData);
  };

  useEffect(() => {
    if (!unitCcMatrixOpen || !unitContextGroup) return;
    void fetch(
      `${apiBase}/api/pnl-unit-cc-matrix?${new URLSearchParams({
        groupBy,
        group: unitContextGroup,
        section: unitContextSection,
        scope: unitCcMatrixScope,
        year,
        ...(level1Param ? { level1: level1Param } : {}),
        ...(periodFilterParam ? { periods: periodFilterParam } : {}),
      })}`
    )
      .then((r) => r.json())
      .then(setUnitCcMatrix);
  }, [groupBy, unitCcMatrixOpen, unitCcMatrixScope, unitContextGroup, unitContextSection, year, level1Param, periodFilterParam]);

  const drillBreadcrumb = () => {
    if (!dimDrill) return drillLabel;
    if (dimDrill.mode === "dim") return drillLabel;
    if (dimDrill.mode === "cc") return `${drillLabel} › ${dimDrill.dim}`;
    if (dimDrill.mode === "movements") return `${drillLabel} › ${dimDrill.dim} › ${dimDrill.cc}`;
    return "";
  };

  const drillBack = () => {
    if (!dimDrill) return;
    if (dimDrill.mode === "cc") {
      void openDimDrill({ id: dimDrill.lineId, label: drillLabel } as PnlRow);
    } else if (dimDrill.mode === "movements") {
      void openCcDrill(dimDrill.lineId, dimDrill.dim);
    } else {
      setDimDrill(null);
    }
  };

  const drillableRow = (r: PnlRow) => r.kind === "detail" || r.kind === "kpi";

  return (
    <div className="app-layout">
      <aside className="side-menu">
        <div className="side-brand">
          <img src="/logo-tiarg-celeste.png" alt="TIARG" className="brand-logo" />
          <p className="eyebrow">TIARG S.A.</p>
          <h2>CFO Workspace</h2>
        </div>
        <button
          type="button"
          className={activeTab === "dashboard" ? "side-link active" : "side-link"}
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={activeTab === "vision-ejecutiva" ? "side-link active" : "side-link"}
          onClick={() => setActiveTab("vision-ejecutiva")}
        >
          Visión Ejecutiva
        </button>
        <button
          type="button"
          className={activeTab === "analisis" ? "side-link active" : "side-link"}
          onClick={() => setActiveTab("analisis")}
        >
          Analisis P&L
        </button>
        {/* DISABLED: Ajustes tab (feature disabled for Phase 1) */}
        <button
          type="button"
          className={activeTab === "cc-explorer" ? "side-link active" : "side-link"}
          onClick={() => setActiveTab("cc-explorer")}
        >
          Explorador CC
        </button>
        <button
          type="button"
          className={activeTab === "importaciones" ? "side-link active" : "side-link"}
          onClick={() => setActiveTab("importaciones")}
        >
          📊 Importaciones
        </button>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(148, 163, 184, 0.35)", fontSize: 12, lineHeight: 1.45 }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Archivos Input</p>
          <p style={{ margin: 0, opacity: year === "2025" ? 1 : 0.75 }}>
            2025: {inputFilesByYear["2025"]}
          </p>
          <p style={{ margin: "4px 0 0", opacity: year === "2026" ? 1 : 0.75 }}>
            2026: {inputFilesByYear["2026"]}
          </p>
        </div>
      </aside>

      <main className="content-area">
        <div className="shell">
          {/* ── HEADER ── */}
          <header className="hero">
            <div>
              <p className="eyebrow">TIARG S.A. | CFO Workspace</p>
              <h1>Profit & Loss</h1>
              <p className="small">Vista activa: {activeTab === "dashboard" ? "Dashboard" : activeTab === "vision-ejecutiva" ? "Visión Ejecutiva" : activeTab === "analisis" ? "Analisis P&L" : activeTab === "cc-explorer" ? "Explorador CC" : "Importaciones"}</p>
            </div>
            <div className="controls">
              <label className="control-field control-field--year">
                Año fiscal
                <select value={year} onChange={(e) => setYear(e.target.value as "2025" | "2026")}>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </label>
              <label className="control-field control-field--search">
                Buscar línea
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ventas, EBITDA, Impuestos…" />
              </label>
              <label className="control-field control-field--multi">
                Nivel 1 Dimensión
                <select
                  className="multi-select"
                  multiple
                  size={3}
                  value={selectedLevel1Dimensions}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                    setSelectedLevel1Dimensions(values);
                  }}
                >
                  {availableLevel1Dimensions.map((dim) => (
                    <option key={`level1-${dim}`} value={dim}>{dim}</option>
                  ))}
                </select>
                <span className="multi-select-meta">{selectedLevel1Dimensions.length} seleccionados</span>
              </label>
              <label className="control-field control-field--multi">
                Período
                <select
                  className="multi-select"
                  multiple
                  size={3}
                  value={selectedFilterPeriods}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                    setSelectedFilterPeriods(values);
                  }}
                >
                  {allPeriods.map((o) => (
                    <option key={`filter-period-${o.period}`} value={o.period}>{o.period}</option>
                  ))}
                </select>
                <span className="multi-select-meta">{selectedFilterPeriods.length} seleccionados</span>
              </label>
              <label className="check control-field control-field--toggle">
                <input type="checkbox" checked={showEspeciales} onChange={(e) => setShowEspeciales(e.target.checked)} />
                Servicios Especiales
              </label>
              <button
                type="button"
                className="btn-upload"
                onClick={() => setIsUploadModalOpen(true)}
                title="Subir nuevo archivo Excel"
              >
                ↑ Subir archivo
              </button>
              <button
                type="button"
                className="btn-upload"
                onClick={() => setIsImportModalOpen(true)}
                title="Importar datos P&L desde Excel"
                style={{ background: "linear-gradient(135deg, rgba(59, 130, 246, 0.5), rgba(99, 102, 241, 0.5))" }}
              >
                ⬇ Importar datos
              </button>
            </div>
          </header>

          {activeTab === "dashboard" ? (
            <>
              {/* ── KPIs ── */}
              <section className="kpi-grid">
                {kpis.map((k) => (
                  <article key={k.title} className="kpi-card">
                    <h3>{k.title}</h3>
                    <p className="value">{fmtCurrency(k.value)}</p>
                    <p className={k.deltaPct >= 0 ? "delta up" : "delta down"}>{fmtPct(k.deltaPct)}</p>
                  </article>
                ))}
              </section>

              {/* ── CHART ── */}
              <section className="chart-card">
                <h2>EBITDA mensual sin Z_ESPECIALES</h2>
                <p className="small">Serie mensual del EBITDA del negocio habitual, excluyendo Z_ESPECIALES.</p>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis width={72} tickFormatter={(value) => fmtCompactNumber(Number(value))} />
                      <Tooltip />
                      <Legend />
                      <Line name="EBITDA" dataKey="habitual" stroke="#0c7a5f" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="chart-card">
                <h2>Facturación mensual por Nivel 1</h2>
                <p className="small">Facturación mensual sin considerar Z_ESPECIALES. La línea marca el total y las barras muestran la mezcla por Nivel 1 de dimensión.</p>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={revenueChart.rows}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tickFormatter={formatPeriodLabel} />
                      <YAxis width={72} tickFormatter={(value) => fmtCompactNumber(Number(value))} />
                      <Tooltip content={<RevenueTooltip />} />
                      <Legend />
                      {revenueChart.dimensions.map((dimension, index) => (
                        <Bar
                          key={dimension}
                          dataKey={dimension}
                          name={dimension}
                          stackId="revenue"
                          fill={revenuePalette[index % revenuePalette.length]}
                        />
                      ))}
                      <Line type="monotone" dataKey="total" name="Total" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          ) : null}

          {activeTab === "vision-ejecutiva" ? (
            <VisionEjecutivaTab
              data={executiveOverview}
              loading={executiveLoading}
              availableCostCenters={availableCostCenters}
              selectedCostCenters={selectedCostCenters}
              onCostCentersChange={setSelectedCostCenters}
              year={year}
              availableLevel1Dimensions={availableLevel1Dimensions}
              allPeriods={allPeriods.map((o) => o.period)}
              globalSelectedPeriods={selectedPeriods}
              globalSelectedLevel1={selectedLevel1Dimensions}
            />
          ) : null}

          {activeTab === "analisis" ? (
            <>

      {/* ── PERIOD SELECTOR ── */}
      <section className="table-card">
        <h2>Selector de períodos</h2>
        <p className="small">Elegí los períodos que querés ver como columnas en el Estado de Resultados. Doble click en una línea para ver su apertura por unidad de negocio.</p>
        <div className="period-options">
          <label className="check">
            <input
              type="checkbox"
              checked={showMonthColumns}
              onChange={(e) => setShowMonthColumns(e.target.checked)}
            />
            Mostrar meses
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={showQuarterColumn}
              onChange={(e) => setShowQuarterColumn(e.target.checked)}
            />
            Mostrar trimestre
          </label>
        </div>
        <div className="period-picker">
          {allPeriods.map((o) => (
            <button
              key={o.period}
              type="button"
              className={selectedPeriods.includes(o.period) ? "period-btn active" : "period-btn"}
              onClick={() => togglePeriod(o.period)}
            >
              {o.period}
            </button>
          ))}
        </div>
        {showMonthColumns && selectedPeriods.length === 0 && (
          <p className="small warn">Seleccioná al menos un período.</p>
        )}
      </section>

      {/* ── P&L TABLE ── */}
      <section className="table-card">
        <h2>Estado de Resultados</h2>
        <div className="pnl-actions">
          <button type="button" className="btn-sm" onClick={expandAllConcepts}>Expandir todo</button>
          <button type="button" className="btn-ghost" onClick={collapseAllConcepts}>Contraer todo</button>
        </div>
        {loading ? <p>Cargando…</p> : null}
        <div className="drill-table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Concepto</th>
                {colPeriods.map((o) => <th key={o.period}>{o.period}</th>)}
                {showQuarterColumn ? <th>Trimestre</th> : null}
                <th>YTD</th>
                <th>Ajuste</th>
              </tr>
            </thead>
            <tbody>
              {visiblePnlRows.map((r) => (
                <tr
                  key={r.id}
                  className={r.kind === "section" ? "section-row" : r.kind === "kpi" ? "kpi-row" : r.kind === "subtotal" ? "subtotal-row" : "detail-row"}
                  onDoubleClick={drillableRow(r) ? () => void openDimDrill(r) : undefined}
                  title={drillableRow(r) ? "Doble click para abrir apertura por unidad de negocio" : undefined}
                >
                  <td className="concept-cell" style={{ paddingLeft: `${12 + r.level * 18}px` }}>
                    {(conceptHierarchy.childCount.get(r.id) ?? 0) > 0 ? (
                      <button
                        type="button"
                        className="tree-toggle"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleConcept(r.id);
                        }}
                        aria-label={collapsedConceptIds[r.id] ? `Expandir ${r.label}` : `Contraer ${r.label}`}
                      >
                        {collapsedConceptIds[r.id] ? "▸" : "▾"}
                      </button>
                    ) : (
                      <span className="tree-toggle-spacer" />
                    )}
                    {drillableRow(r) ? <span className="drill-hint">⬡</span> : null} {r.label}
                  </td>
                  {colPeriods.map((o) => (
                    <td key={o.period}>{fmtCurrency(lineAmounts[r.id]?.[o.period] ?? 0)}</td>
                  ))}
                  {showQuarterColumn ? <td>{fmtCurrency(r.quarter)}</td> : null}
                  <td>{fmtCurrency(r.ytd)}</td>
                  <td>
                    {/* DISABLED: Ajustar button (ajustes feature disabled)
                    {drillableRow(r) ? (
                      <button
                        type="button"
                        className="btn-sm"
                        onClick={() => { setAdjLineId(r.id); setAdjLineLabel(r.label); setAdjMsg(""); }}
                      >
                        Ajustar
                      </button>
                    ) : null}
                    */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── DRILL PANEL ── */}
      <section className="drill-grid">

        {/* DRILL PANEL */}
        <article className="drill-card">
          <div className="drill-header">
            <h2>Apertura por unidad de negocio</h2>
            <label>
              Corte de apertura
              <select value={drillScope} onChange={(e) => setDrillScope(e.target.value as DrillScope)}>
                <option value="month">Mes actual</option>
                <option value="quarter">Trimestre actual</option>
                <option value="ytd">YTD</option>
                <option value="selected">Períodos seleccionados</option>
              </select>
            </label>
            {dimDrill ? (
              <div className="drill-nav">
                <span className="breadcrumb">{drillBreadcrumb()}</span>
                <button type="button" className="btn-sm" onClick={drillBack}>← Atrás</button>
                <button type="button" className="btn-sm btn-ghost" onClick={() => setDimDrill(null)}>✕ Cerrar</button>
              </div>
            ) : null}
          </div>

          {!dimDrill && (
            <p className="small muted-hint">Hacé doble click en cualquier línea del Estado de Resultados para ver su apertura por Nivel 1 de dimensión (BU/Unidad). En la tabla de Nivel 1: click abre centros de costo, doble click abre el P&L completo de esa unidad.</p>
          )}

          {dimDrill?.mode === "dim" && (
            <div className="drill-table-wrap">
              <table>
                <thead><tr><th>Unidad de negocio (Nivel 1)</th><th>{drillScopeLabel}</th></tr></thead>
                <tbody>
                  {dimDrill.rows.length === 0 && <tr><td colSpan={2} className="muted-hint">Sin datos para esta línea en los períodos seleccionados.</td></tr>}
                  {dimDrill.rows.map((row) => (
                    <tr
                      key={row.group}
                      className="clickable"
                      onClick={() => void openCcDrill(dimDrill.lineId, row.group)}
                      onDoubleClick={() => void onOpenUnit(row.group, "all")}
                      title="Click: centros de costo | Doble click: P&L completo de la unidad"
                    >
                      <td>{row.group} <span className="drill-hint">→</span></td>
                      <td>{fmtCurrency(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dimDrill?.mode === "cc" && (
            <div className="drill-table-wrap">
              <table>
                <thead><tr><th>Centro de costo</th><th>{drillScopeLabel}</th></tr></thead>
                <tbody>
                  {dimDrill.rows.length === 0 && <tr><td colSpan={2} className="muted-hint">Sin centros de costo para esta unidad.</td></tr>}
                  {dimDrill.rows.map((row) => (
                    <tr key={row.costCenter} className="clickable" onClick={() => void openMovements(dimDrill.lineId, dimDrill.dim, row.costCenter)} title="Click para ver cuentas">
                      <td>{row.costCenter} <span className="drill-hint">→</span></td>
                      <td>{fmtCurrency(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dimDrill?.mode === "movements" && (
            <div className="drill-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cuenta contable</th>
                    <th>{drillScopeLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {dimDrill.rows.length === 0 && <tr><td colSpan={2} className="muted-hint">Sin movimientos.</td></tr>}
                  {dimDrill.rows.map((d) => (
                    <tr key={d.id}>
                      <td>{d.account}</td>
                      <td>{fmtCurrency(d.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      {/* ── P&L COMPLETO POR BU (contexto jerárquico) ── */}
      <section className="table-card">
        <h2>Estado de Resultados Completo por BU (Nivel 1)</h2>
        <p className="small">Foto completa: filas = líneas P&L, columnas = Nivel 1 (BU). Base para explorar en detalle.</p>
        <div className="matrix-controls">
          <label>
            Corte
            <select value={buMatrixScope} onChange={(e) => setBuMatrixScope(e.target.value as "month" | "quarter" | "ytd")}>
              <option value="month">Mes</option>
              <option value="quarter">Trimestre</option>
              <option value="ytd">YTD</option>
            </select>
          </label>
          <label>
            Bloque
            <select value={buMatrixSection} onChange={(e) => setBuMatrixSection(e.target.value as "habitual" | "especiales" | "all")}>
              <option value="habitual">Negocio habitual</option>
              <option value="especiales">Servicios especiales</option>
              <option value="all">Todo</option>
            </select>
          </label>
        </div>
        <div className="drill-table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>Concepto</th>
                {(buMatrix?.columns || []).map((c) => <th key={c}>{c}</th>)}
                <th>Total Empresa</th>
              </tr>
            </thead>
            <tbody>
              {(buMatrix?.rows || []).map((r) => (
                <tr key={`bu-matrix-${r.id}`} className={r.kind === "kpi" ? "kpi-row" : r.kind === "subtotal" ? "subtotal-row" : r.kind === "section" ? "section-row" : "detail-row"}>
                  <td className="concept-cell" style={{ paddingLeft: `${12 + r.level * 18}px` }}>{r.label}</td>
                  {(buMatrix?.columns || []).map((c) => (
                    <td key={`${r.id}-${c}`}>{fmtCurrency(r.values[c] || 0)}</td>
                  ))}
                  <td>{fmtCurrency(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── BREAKDOWN POR BU / CC ── */}
      <section className="table-card">
        <h2>Análisis por BU / Centro de Costo</h2>
        <p className="small">Doble click en una fila para abrir el P&L completo de esa unidad.</p>
        <div className="matrix-controls">
          <label>
            Agrupar por
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as "bu" | "cc")}>
              <option value="bu">BU (Nivel 1)</option>
              <option value="cc">Centro de costo</option>
            </select>
          </label>
          <label>
            Bloque
            <select value={breakSection} onChange={(e) => setBreakSection(e.target.value as "habitual" | "especiales" | "all")}>
              <option value="habitual">Negocio habitual</option>
              <option value="especiales">Servicios especiales</option>
              <option value="all">Todo</option>
            </select>
          </label>
          <label>
            Métrica
            <select value={breakMetric} onChange={(e) => setBreakMetric(e.target.value as "ventas" | "margenBruto" | "ebitda")}>
              <option value="ventas">Ventas</option>
              <option value="margenBruto">Margen Bruto</option>
              <option value="ebitda">EBITDA</option>
            </select>
          </label>
        </div>
        <div className="period-options">
          <label className="check">
            <input
              type="checkbox"
              checked={breakShowMonths}
              onChange={(e) => setBreakShowMonths(e.target.checked)}
            />
            Mostrar meses
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={breakShowQuarter}
              onChange={(e) => setBreakShowQuarter(e.target.checked)}
            />
            Mostrar trimestre
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={breakShowYtd}
              onChange={(e) => setBreakShowYtd(e.target.checked)}
            />
            Mostrar YTD
          </label>
        </div>
        {!breakShowMonths && !breakShowQuarter && !breakShowYtd ? (
          <p className="small warn">Activá al menos una vista: meses, trimestre o YTD.</p>
        ) : null}
        <div className="drill-table-wrap">
          <table>
            <thead>
              <tr>
                <th>{groupBy.toUpperCase()}</th>
                {breakShowMonths ? breakdownMonthColumns.map((m) => <th key={m.label}>{m.label}</th>) : null}
                {breakShowQuarter ? breakdownQuarterLabels.map((q) => <th key={q}>{q}</th>) : null}
                {breakShowYtd ? <th>{breakdown?.periods.ytd || "YTD"}</th> : null}
              </tr>
            </thead>
            <tbody>
              {(breakdown?.rows || []).map((r) => (
                <tr key={r.group} className="clickable" onDoubleClick={() => void onOpenUnit(r.group)} title="Doble click para abrir P&L de la unidad">
                  <td>{r.group}</td>
                  {breakShowMonths ? breakdownMonthColumns.map((m) => <td key={`${r.group}-${m.label}`}>{fmtCurrency(r[breakMetric].months[m.idx] || 0)}</td>) : null}
                  {breakShowQuarter ? breakdownQuarterLabels.map((q) => <td key={`${r.group}-${q}`}>{fmtCurrency(getQuarterValue(r[breakMetric].months, q))}</td>) : null}
                  {breakShowYtd ? <td>{fmtCurrency(r[breakMetric].ytd)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── P&L UNIDAD ── */}
      {unitPnl ? (
        <section className="table-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>P&L unidad: {unitPnl.unit}</h2>
            <button type="button" className="btn-ghost" onClick={() => { setUnitPnl(null); setUnitCcBreakdown(null); }}>✕ Cerrar</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                {breakShowMonths ? <th>{unitPnl.periods.month}</th> : null}
                {breakShowQuarter ? <th>{unitPnl.periods.quarter}</th> : null}
                {breakShowYtd ? <th>{unitPnl.periods.ytd}</th> : null}
              </tr>
            </thead>
            <tbody>
              {unitPnl.rows.map((r) => (
                <tr key={`unit-${r.id}`} className={r.kind === "kpi" ? "kpi-row" : r.kind === "subtotal" ? "subtotal-row" : "detail-row"}>
                  <td>{r.label}</td>
                  {breakShowMonths ? <td>{fmtCurrency(r.month)}</td> : null}
                  {breakShowQuarter ? <td>{fmtCurrency(r.quarter)}</td> : null}
                  {breakShowYtd ? <td>{fmtCurrency(r.ytd)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>

          {unitCcBreakdown ? (
            <>
              <h3 style={{ marginTop: 16 }}>Apertura por Centro de Costo</h3>
              <div className="matrix-controls">
                <label>
                  Métrica
                  <select value={unitCcMetric} onChange={(e) => setUnitCcMetric(e.target.value as "ventas" | "margenBruto" | "ebitda") }>
                    <option value="ventas">Ventas</option>
                    <option value="margenBruto">Margen Bruto</option>
                    <option value="ebitda">EBITDA</option>
                  </select>
                </label>
                <button
                  type="button"
                  className={unitCcMatrixOpen ? "btn-sm" : "btn-ghost"}
                  onClick={() => setUnitCcMatrixOpen((v) => !v)}
                >
                  {unitCcMatrixOpen ? "Ocultar vista por CC (columnas)" : "Abrir por CC"}
                </button>
              </div>
              <div className="drill-table-wrap" style={{ marginTop: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Centro de costo</th>
                      {breakShowMonths ? (unitCcBreakdown.monthLabels || []).map((m) => <th key={`unit-cc-${m}`}>{m}</th>) : null}
                      {breakShowYtd ? <th>{unitCcBreakdown.periods.ytd}</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {(unitCcBreakdown.rows || []).map((r) => (
                      <tr key={`unit-cc-row-${r.costCenter}`}>
                        <td>{r.costCenter}</td>
                        {breakShowMonths ? r[unitCcMetric].months.map((v, i) => <td key={`unit-cc-${r.costCenter}-${i}`}>{fmtCurrency(v)}</td>) : null}
                        {breakShowYtd ? <td>{fmtCurrency(r[unitCcMetric].ytd)}</td> : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {unitCcMatrixOpen ? (
                <div className="drill-table-wrap" style={{ marginTop: 14 }}>
                  <div className="matrix-controls" style={{ marginBottom: 8 }}>
                    <label>
                      Corte matriz CC
                      <select
                        value={unitCcMatrixScope}
                        onChange={(e) => setUnitCcMatrixScope(e.target.value as "month" | "quarter" | "ytd")}
                      >
                        <option value="month">Mes</option>
                        <option value="quarter">Trimestre</option>
                        <option value="ytd">YTD</option>
                      </select>
                    </label>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ minWidth: 240 }}>Concepto</th>
                        {(unitCcMatrix?.columns || []).map((c) => <th key={`unit-cc-col-${c}`}>{c}</th>)}
                        <th>Total unidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(unitCcMatrix?.rows || []).map((r) => (
                        <tr key={`unit-cc-matrix-${r.id}`} className={r.kind === "kpi" ? "kpi-row" : r.kind === "subtotal" ? "subtotal-row" : r.kind === "section" ? "section-row" : "detail-row"}>
                          <td className="concept-cell" style={{ paddingLeft: `${12 + r.level * 18}px` }}>{r.label}</td>
                          {(unitCcMatrix?.columns || []).map((c) => <td key={`${r.id}-${c}`}>{fmtCurrency(r.values[c] || 0)}</td>)}
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
          ) : null}

          {/* DISABLED: Ajustes panel */}
          {false && activeTab === "ajustes" ? (
            <>
              <article className="adjust-card">
                <h2>Ajuste de gestión</h2>
                <p className="small">Separá reclasificaciones (resultado vs resultado) de ajustes con impacto en resultado (contra patrimonial), siempre en partida doble.</p>
                {adjLineId ? <p className="small">Referencia desde línea: <strong>{adjLineLabel}</strong></p> : null}

                <label>
                  Tipo de ajuste
                  <select value={adjKind} onChange={(e) => setAdjKind(e.target.value as "reclassification" | "result_impact")}>
                    <option value="reclassification">Reclasificación (cuenta/centro)</option>
                    <option value="result_impact">Impacto en resultado (contra patrimonial)</option>
                  </select>
                </label>

                <label>
                  Monto (ARS)
                  <input type="number" min={0} value={adjAmount} onChange={(e) => setAdjAmount(Number(e.target.value || 0))} />
                </label>

                <div className="adj-entry-grid">
                  <div className="adj-entry-card">
                    <h3>Debe</h3>
                    <label>
                      Cuenta
                      <select value={adjDebitAccount} onChange={(e) => setAdjDebitAccount(e.target.value)}>
                        <option value="">Seleccionar cuenta</option>
                        {adjOptions.accounts.map((acc) => (
                          <option key={`debit-acc-${acc}`} value={acc}>{acc}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Centro de costo
                      <select value={adjDebitCC} onChange={(e) => setAdjDebitCC(e.target.value)}>
                        <option value="">Seleccionar centro de costo</option>
                        {adjOptions.costCenters.map((cc) => (
                          <option key={`debit-cc-${cc}`} value={cc}>{cc}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Período
                      <select value={adjDebitPeriod} onChange={(e) => setAdjDebitPeriod(e.target.value)}>
                        <option value="">Seleccionar período</option>
                        {adjOptions.periods.map((p) => (
                          <option key={`debit-period-${p}`} value={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="adj-entry-card">
                    <h3>Haber</h3>
                    <label>
                      Cuenta
                      <select value={adjCreditAccount} onChange={(e) => setAdjCreditAccount(e.target.value)}>
                        <option value="">Seleccionar cuenta</option>
                        {adjOptions.accounts.map((acc) => (
                          <option key={`credit-acc-${acc}`} value={acc}>{acc}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Centro de costo
                      <select value={adjCreditCC} onChange={(e) => setAdjCreditCC(e.target.value)}>
                        <option value="">Seleccionar centro de costo</option>
                        {adjOptions.costCenters.map((cc) => (
                          <option key={`credit-cc-${cc}`} value={cc}>{cc}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Período
                      <select value={adjCreditPeriod} onChange={(e) => setAdjCreditPeriod(e.target.value)}>
                        <option value="">Seleccionar período</option>
                        {adjOptions.periods.map((p) => (
                          <option key={`credit-period-${p}`} value={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <label>
                  Nota / justificación
                  <textarea
                    value={adjNote}
                    onChange={(e) => setAdjNote(e.target.value)}
                    placeholder="Ej: reclasificación de costo entre centros, sin impacto neto"
                  />
                </label>

                <button type="button" onClick={() => void onSaveAdjustment()}>{editingAdjustmentId ? "Guardar cambios" : "Guardar ajuste"}</button>
                <button type="button" className="btn-ghost" onClick={() => { resetAdjustmentForm(); setAdjMsg(""); }}>{editingAdjustmentId ? "Cancelar edición" : "Limpiar formulario"}</button>
                {adjMsg ? <p className="small adj-ok">{adjMsg}</p> : null}
              </article>

              {savedAdjustments.length > 0 ? (
                <section className="table-card" style={{ marginTop: 24 }}>
                  <h2>Ajustes registrados</h2>
                  <div className="drill-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Monto</th>
                          <th>Nota</th>
                          <th>Fecha</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedAdjustments.map((a) => (
                          <tr key={a.id}>
                            <td>{a.kind === "reclassification" ? "Reclasificación" : "Impacto resultado"}</td>
                            <td>{fmtCurrency(a.amount)}</td>
                            <td>{a.note}</td>
                            <td>{new Date(a.createdAt).toLocaleDateString("es-AR")}</td>
                            <td>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button type="button" className="btn-sm" onClick={() => startEditingAdjustment(a)}>Editar</button>
                                <button type="button" className="btn-sm btn-ghost" onClick={() => void onDeleteAdjustment(a)}>Eliminar</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {activeTab === "cc-explorer" ? (
            <section className="table-card">
              <h2>Explorador por Centro de Costo</h2>
              <p className="small">Buscá todos los movimientos de un centro de costo en un período determinado, sin importar a qué línea del P&L pertenecen.</p>

              <div className="matrix-controls" style={{ alignItems: "flex-end", gap: 12 }}>
                <label>
                  Centro de costo
                  <input
                    list="cc-list"
                    value={ccExplorerCC}
                    onChange={(e) => setCcExplorerCC(e.target.value)}
                    placeholder="Ej: PRD, CORP, etc."
                    style={{ minWidth: 180 }}
                  />
                  <datalist id="cc-list">
                    {ccAvailable.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </label>
                <label>
                  Período (YYYY-MM)
                  <input
                    list="explorer-period-list"
                    value={ccExplorerPeriod}
                    onChange={(e) => setCcExplorerPeriod(e.target.value)}
                    placeholder="Ej: 2025-11 (vacío = todos)"
                    style={{ minWidth: 160 }}
                  />
                  <datalist id="explorer-period-list">
                    {allPeriods.map((o) => <option key={o.period} value={o.period} />)}
                  </datalist>
                </label>
                <button type="button" onClick={() => void runCcExplorer()} disabled={ccExplorerLoading || !ccExplorerCC.trim()}>
                  {ccExplorerLoading ? "Buscando…" : "Explorar"}
                </button>
              </div>

              {ccExplorerResult ? (
                ccExplorerResult.rows.length === 0 ? (
                  <p className="small warn" style={{ marginTop: 16 }}>Sin movimientos para <strong>{ccExplorerResult.cc}</strong> en {ccExplorerResult.periods.join(", ") || "todos los períodos"}.</p>
                ) : (
                  <>
                    <p className="small" style={{ marginTop: 16 }}>
                      <strong>{ccExplorerResult.cc}</strong> — períodos: {ccExplorerResult.periods.join(", ")} — Total: <strong>{fmtCurrency(ccExplorerResult.grandTotal)}</strong>
                    </p>
                    <div className="drill-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Cuenta contable</th>
                            <th>Categoría (nivel 3)</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ccExplorerResult.rows.map((r) => (
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
                !ccExplorerLoading ? <p className="small muted-hint" style={{ marginTop: 16 }}>Ingresá un centro de costo y hacé click en Explorar.</p> : null
              )}
            </section>
          ) : null}

          {activeTab === "importaciones" ? (
            <ImportHistory apiBase="" />
          ) : null}
        </div>

        <FileUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => {
            // Could refresh file metadata here if needed
          }}
        />

        <DataImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setActiveTab("importaciones");
            // Could refresh import history here if needed
          }}
          apiBase=""
        />
      </main>
    </div>
  );
}

export default App;
