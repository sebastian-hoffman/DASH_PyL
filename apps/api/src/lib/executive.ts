import type { SourcePnlRow } from "../types/index.js";
import { isSpecialRow } from "./classify.js";

/**
 * Ramas del plan de cuentas (Nivel 3 cuenta), en el orden real del árbol
 * contable. Sin reclasificación gerencial (ni split RRHH directo/estructura
 * por centro de costo, ni casos especiales por nombre de cuenta): lo que
 * cae bajo cada rama es exactamente lo que dice "Nivel 3 cuenta" en el
 * origen, así que una cuenta nueva se clasifica sola sin tocar código.
 *
 * "ingresos" y "gastos" arman el EBITDA. "belowLine" (One time costs y
 * Resultado Financiero) queda fuera del EBITDA y solo se suma en el Total.
 */
const BRANCH_DEFS: { level3: string; label: string; group: "ingresos" | "gastos" | "belowLine" }[] = [
  { level3: "1.1 Ingresos por Venta",         label: "Ventas",                     group: "ingresos" },
  { level3: "2.1 Recursos Humanos",           label: "Recursos Humanos",           group: "gastos" },
  { level3: "2.2 Costos Directos",            label: "Costos Directos",            group: "gastos" },
  { level3: "2.3 Gastos de Estructura",       label: "Gastos de Estructura",       group: "gastos" },
  { level3: "2.3 Gastos de Estructura Tec",   label: "Gastos de Estructura Tec",   group: "gastos" },
  { level3: "2.4 Gastos de Comercializacion", label: "Gastos de Comercialización", group: "gastos" },
  { level3: "2.5 Impuestos",                  label: "Impuestos",                  group: "gastos" },
  { level3: "2.7 One time costs",             label: "One Time Costs",             group: "belowLine" },
  { level3: "3.1 Resultados Financieros",     label: "Resultado Financiero",       group: "belowLine" },
];

const TOP_ACCOUNTS_PER_BRANCH = 6;

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

const sumAmount = (rows: SourcePnlRow[]): number => rows.reduce((sum, r) => sum + r.amount, 0);

/** No recibe "scope": suma exactamente las filas ya filtradas por período/año/Nivel 1 aguas arriba. */
export const buildExecutiveOverview = (sourceRows: SourcePnlRow[], includeSpecials?: boolean): ExecutiveOverview => {
  const rows = sourceRows.filter((r) => includeSpecials || !isSpecialRow(r));
  const periods = [...new Set(rows.map((r) => r.period))].filter(Boolean).sort();

  const revenueRows = rows.filter((r) => r.level3 === "1.1 Ingresos por Venta");
  const revenueValue = sumAmount(revenueRows);
  const revenueByPeriod: Record<string, number> = {};
  for (const p of periods) revenueByPeriod[p] = sumAmount(revenueRows.filter((r) => r.period === p));

  const pctOf = (value: number, base: number): number => (base !== 0 ? (value / base) * 100 : 0);

  const branches: ExecutiveBranch[] = BRANCH_DEFS.map((def) => {
    const branchRows = rows.filter((r) => r.level3 === def.level3);
    const value = sumAmount(branchRows);

    const byPeriod: Record<string, ExecutiveMetric> = {};
    for (const p of periods) {
      const periodValue = sumAmount(branchRows.filter((r) => r.period === p));
      byPeriod[p] = { value: periodValue, pctRevenue: pctOf(periodValue, revenueByPeriod[p]) };
    }

    const totalsByAccount = new Map<string, number>();
    for (const r of branchRows) {
      totalsByAccount.set(r.account, (totalsByAccount.get(r.account) ?? 0) + r.amount);
    }
    const sorted = [...totalsByAccount.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const topAccountNames = new Set(sorted.slice(0, TOP_ACCOUNTS_PER_BRANCH).map(([account]) => account));
    const restAccountNames = new Set(sorted.slice(TOP_ACCOUNTS_PER_BRANCH).map(([account]) => account));

    const accountByPeriod = (accountNames: Set<string>, p: string) =>
      sumAmount(branchRows.filter((r) => r.period === p && accountNames.has(r.account)));

    const accounts: ExecutiveAccountItem[] = [...topAccountNames].map((account) => {
      const total = totalsByAccount.get(account) ?? 0;
      const accByPeriod: Record<string, number> = {};
      for (const p of periods) accByPeriod[p] = accountByPeriod(new Set([account]), p);
      return { account, total, pctOfBranch: value !== 0 ? (total / value) * 100 : 0, byPeriod: accByPeriod };
    });
    if (restAccountNames.size) {
      const restTotal = [...restAccountNames].reduce((sum, account) => sum + (totalsByAccount.get(account) ?? 0), 0);
      const restByPeriod: Record<string, number> = {};
      for (const p of periods) restByPeriod[p] = accountByPeriod(restAccountNames, p);
      accounts.push({ account: "Otros", total: restTotal, pctOfBranch: value !== 0 ? (restTotal / value) * 100 : 0, byPeriod: restByPeriod });
    }

    return {
      id: def.level3,
      label: def.label,
      group: def.group,
      total: { value, pctRevenue: pctOf(value, revenueValue) },
      byPeriod,
      accounts,
    };
  });

  const ebitdaBranches = branches.filter((b) => b.group === "ingresos" || b.group === "gastos");
  const ebitdaValue = ebitdaBranches.reduce((sum, b) => sum + b.total.value, 0);
  const ebitdaByPeriod: Record<string, ExecutiveMetric> = {};
  for (const p of periods) {
    const v = ebitdaBranches.reduce((sum, b) => sum + (b.byPeriod[p]?.value ?? 0), 0);
    ebitdaByPeriod[p] = { value: v, pctRevenue: pctOf(v, revenueByPeriod[p]) };
  }

  const netResultValue = branches.reduce((sum, b) => sum + b.total.value, 0);
  const netResultByPeriod: Record<string, ExecutiveMetric> = {};
  for (const p of periods) {
    const v = branches.reduce((sum, b) => sum + (b.byPeriod[p]?.value ?? 0), 0);
    netResultByPeriod[p] = { value: v, pctRevenue: pctOf(v, revenueByPeriod[p]) };
  }

  const periodLabel =
    periods.length === 0 ? "Sin datos" :
    periods.length === 1 ? periods[0] :
    `${periods[0]} – ${periods[periods.length - 1]}`;

  return {
    periods,
    periodLabel,
    revenue: { value: revenueValue, pctRevenue: 100 },
    branches,
    ebitda: { value: ebitdaValue, pctRevenue: pctOf(ebitdaValue, revenueValue) },
    ebitdaByPeriod,
    netResult: { value: netResultValue, pctRevenue: pctOf(netResultValue, revenueValue) },
    netResultByPeriod,
  };
};
