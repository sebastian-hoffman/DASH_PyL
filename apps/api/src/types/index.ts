export type Kpi = {
  title: string;
  value: number;
  deltaPct: number;
};

export type PnlRow = {
  id: string;
  section: "negocio" | "especiales";
  line: string;
  month: number;
  quarter: number;
  ytd: number;
  hasAdjustments: boolean;
};

export type DrillRow = {
  id: string;
  date: string;
  document: string;
  account: string;
  costCenter: string;
  detail: string;
  amount: number;
  adjustedAmount: number;
};

export type PnlStructuredRow = {
  id: string;
  label: string;
  level: number;
  kind: "section" | "detail" | "subtotal" | "kpi";
  month: number;
  quarter: number;
  ytd: number;
  hasAdjustments: boolean;
};

export type MetricSeries = {
  months: number[];
  ytd: number;
};

export type Adjustment = {
  id: string;
  lineId: string;
  adjustmentType: "reclass" | "fixed_amount";
  amount: number;
  target: "all" | "month" | "quarter" | "ytd";
  note: string;
  createdAt: string;
};

export type JournalLeg = {
  account: string;
  costCenter: string;
  period: string;
};

export type JournalAdjustment = {
  id: string;
  kind: "reclassification" | "result_impact";
  amount: number;
  debit: JournalLeg;
  credit: JournalLeg;
  note: string;
  referenceLineId?: string;
  createdAt: string;
};

export type MatrixAxis = "concept" | "cost_center" | "period";

export type SourcePnlRow = {
  period: string;
  quarter: string;
  account: string;
  costCenter: string;
  ccLevel1: string;
  ccLevel2: string;
  level2: string;
  level3: string;
  amount: number;
};

export type Triple = { month: number; quarter: number; ytd: number };

export type RevenueChartPoint = {
  month: string;
  total: number;
  [dimension: string]: string | number;
};

export type RevenueChartResponse = {
  dimensions: string[];
  rows: RevenueChartPoint[];
};
