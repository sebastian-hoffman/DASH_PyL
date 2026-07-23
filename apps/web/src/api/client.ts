import type {
  AdjustmentOptions,
  BuMatrixResponse,
  BreakdownResponse,
  ChartPoint,
  DrillRow,
  GroupBy,
  Kpi,
  MatrixScope,
  PeriodOption,
  PnlRow,
  SavedAdjustment,
  Section,
  UnitCcBreakdownResponse,
  UnitCcMatrixResponse,
  UnitPnlResponse,
} from "../types/index.js";

const apiBase = import.meta.env.VITE_API_URL as string || "http://localhost:4000";

const get = <T>(path: string, params?: Record<string, string>): Promise<T> => {
  const url = new URL(`${apiBase}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return fetch(url.toString()).then((r) => r.json()) as Promise<T>;
};

export const fetchOverview = () =>
  get<{ kpis: Kpi[]; chart: ChartPoint[] }>("/api/overview");

export const fetchPnl = () =>
  get<{ rows: PnlRow[]; periods: { month: string; quarter: string; ytd: string } }>("/api/pnl");

export const fetchPeriods = () =>
  get<{ periods: PeriodOption[] }>("/api/periods");

export const fetchAdjustmentOptions = () =>
  get<AdjustmentOptions>("/api/adjustment-options");

export const fetchSavedAdjustments = () =>
  get<{ adjustments: SavedAdjustment[] }>("/api/adjustments");

export const fetchBreakdown = (groupBy: GroupBy, section: Section) =>
  get<BreakdownResponse>("/api/pnl-breakdown", { groupBy, section });

export const fetchBuMatrix = (scope: MatrixScope, section: Section) =>
  get<BuMatrixResponse>("/api/pnl-bu-matrix", { scope, section });

export const fetchUnitPnl = (groupBy: GroupBy, group: string, section: Section) =>
  get<UnitPnlResponse>("/api/pnl-unit", { groupBy, group, section });

export const fetchUnitCcBreakdown = (groupBy: GroupBy, group: string, section: Section) =>
  get<UnitCcBreakdownResponse>("/api/pnl-unit-cc-breakdown", { groupBy, group, section });

export const fetchUnitCcMatrix = (groupBy: GroupBy, group: string, section: Section, scope: MatrixScope) =>
  get<UnitCcMatrixResponse>("/api/pnl-unit-cc-matrix", { groupBy, group, section, scope });

export const fetchDimDrill = (lineId: string, periods: string, dim?: string, cc?: string) => {
  const params: Record<string, string> = { lineId, periods };
  if (dim) params.dim = dim;
  if (cc)  params.cc  = cc;
  return get<{ mode: string; rows: { group?: string; costCenter?: string; total: number }[] | DrillRow[] }>(
    "/api/pnl-dim-drill", params
  );
};

export const fetchLineAmounts = (lineId: string, period: string): Promise<{ rows: { total: number }[] }> =>
  get("/api/pnl-dim-drill", { lineId, periods: period });

export const fetchCcExplorer = (cc: string, periods?: string) => {
  const params: Record<string, string> = { cc };
  if (periods) params.periods = periods;
  return get<{
    cc: string; periods: string[]; grandTotal: number;
    rows: { account: string; level2: string; level3: string; total: number }[];
    availableCCs: string[];
  }>("/api/cc-explorer", params);
};

export const postAdjustment = (body: Record<string, unknown>): Promise<{ saved: boolean }> =>
  fetch(`${apiBase}/api/adjustments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json()) as Promise<{ saved: boolean }>;
