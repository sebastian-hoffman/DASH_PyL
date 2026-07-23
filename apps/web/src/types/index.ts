export type Kpi = { title: string; value: number; deltaPct: number };
export type ChartPoint = { month: string; habitual: number };

export type PnlRow = {
  id: string; label: string; level: number;
  kind: "section" | "detail" | "subtotal" | "kpi";
  month: number; quarter: number; ytd: number; hasAdjustments: boolean;
};

export type DrillRow = {
  id: string; date: string; document: string; account: string;
  costCenter: string; detail: string; amount: number; adjustedAmount: number;
};

export type MetricSeries = { months: number[]; ytd: number };

export type BreakdownRow = {
  group: string;
  ventas: MetricSeries; costoVentas: MetricSeries;
  margenBruto: MetricSeries; gastosOp: MetricSeries; ebitda: MetricSeries;
};

export type BreakdownResponse = {
  periods: { month: string; quarter: string; ytd: string };
  monthLabels: string[];
  rows: BreakdownRow[];
};

export type BuMatrixRow = {
  id: string; label: string; level: number;
  kind: "section" | "detail" | "subtotal" | "kpi";
  values: Record<string, number>; total: number;
};

export type BuMatrixResponse = {
  scope: "month" | "quarter" | "ytd";
  section: "habitual" | "especiales" | "all";
  columns: string[]; rows: BuMatrixRow[];
};

export type UnitPnlResponse = {
  periods: { month: string; quarter: string; ytd: string };
  unit: string; rows: PnlRow[];
};

export type UnitCcBreakdownRow = {
  costCenter: string;
  ventas: MetricSeries; costoVentas: MetricSeries;
  margenBruto: MetricSeries; gastosOp: MetricSeries; ebitda: MetricSeries;
};

export type UnitCcBreakdownResponse = {
  unit: string;
  periods: { month: string; quarter: string; ytd: string };
  monthLabels: string[];
  rows: UnitCcBreakdownRow[];
};

export type UnitCcMatrixRow = {
  id: string; label: string; level: number;
  kind: "section" | "detail" | "subtotal" | "kpi";
  values: Record<string, number>; total: number;
};

export type UnitCcMatrixResponse = {
  unit: string;
  scope: "month" | "quarter" | "ytd";
  section: "habitual" | "especiales" | "all";
  columns: string[]; rows: UnitCcMatrixRow[];
};

export type AdjustmentOptions = {
  accounts: string[]; costCenters: string[]; periods: string[];
};

export type SavedAdjustment = {
  id: string; kind: string; amount: number; note: string; createdAt: string;
};

export type PeriodOption = { period: string; quarter: string };

export type DrillScope = "month" | "quarter" | "ytd" | "selected";

export type DimDrillState =
  | null
  | { mode: "dim"; lineId: string; rows: { group: string; total: number }[] }
  | { mode: "cc";  lineId: string; dim: string; rows: { costCenter: string; total: number }[] }
  | { mode: "movements"; lineId: string; dim: string; cc: string; rows: DrillRow[] };

export type ActiveTab = "dashboard" | "analisis" | "ajustes" | "cc-explorer";

export type GroupBy   = "bu" | "vertical" | "area" | "cc";
export type Section   = "habitual" | "especiales" | "all";
export type Metric    = "ventas" | "margenBruto" | "ebitda";
export type MatrixScope = "month" | "quarter" | "ytd";
