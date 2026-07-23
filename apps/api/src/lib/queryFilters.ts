import type { SourcePnlRow } from "../types/index.js";

export const parseLevel1Param = (value: unknown): string[] => {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export const filterRowsByLevel1 = (rows: SourcePnlRow[], selectedLevel1: string[]): SourcePnlRow[] => {
  if (!selectedLevel1.length) return rows;
  const allowed = new Set(selectedLevel1);
  return rows.filter((row) => allowed.has(row.ccLevel1 || "Sin BU"));
};

export const parsePeriodsParam = (value: unknown): string[] => {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export const filterRowsByPeriods = (rows: SourcePnlRow[], selectedPeriods: string[]): SourcePnlRow[] => {
  if (!selectedPeriods.length) return rows;
  const allowed = new Set(selectedPeriods);
  return rows.filter((row) => allowed.has(row.period));
};

export const parseCostCenterParam = (value: unknown): string[] => {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export const filterRowsByCostCenter = (rows: SourcePnlRow[], selectedCostCenters: string[]): SourcePnlRow[] => {
  if (!selectedCostCenters.length) return rows;
  const allowed = new Set(selectedCostCenters);
  return rows.filter((row) => allowed.has(row.costCenter));
};
