import { loadSourceRows } from "../data/loader.js";
import type { MetricSeries, SourcePnlRow } from "../types/index.js";
import { RRHH_ACCOUNTS, isCorpCostCenter, isSpecialRow } from "./classify.js";
import { lower } from "./helpers.js";
import { buildUnitPnl } from "./pnl.js";

// ─── buildBusinessBreakdown ───────────────────────────────────────────────────

export const buildBusinessBreakdown = (
  groupBy: "bu" | "vertical" | "area" | "cc",
  section: "habitual" | "especiales" | "all",
  sourceRows?: SourcePnlRow[]
) => {
  const rows = sourceRows ?? loadSourceRows();
  const periods = [...new Set(rows.map((r) => r.period))].filter(Boolean).sort();
  const currentPeriod = periods[periods.length - 1] ?? "";
  const year = currentPeriod.split("-")[0] ?? "";
  const currentQuarter = rows.find((r) => r.period === currentPeriod)?.quarter ?? "";

  const isYtd    = (r: SourcePnlRow) => r.period.startsWith(`${year}-`) && r.period <= currentPeriod;
  const isCorpCC = (r: SourcePnlRow) => isCorpCostCenter(r.costCenter);

  const monthLabels = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const monthIndex  = new Map(monthLabels.map((m, i) => [m, i]));

  const emptySeries = (): MetricSeries => ({ months: Array.from({ length: 12 }, () => 0), ytd: 0 });

  type GroupBucket = {
    ventas: MetricSeries;
    otrosIngresos: MetricSeries;
    costoVentas: MetricSeries;
    margenBruto: MetricSeries;
    gastosOp: MetricSeries;
    ebitda: MetricSeries;
  };
  const grouped = new Map<string, GroupBucket>();

  const ensure = (key: string): GroupBucket => {
    if (!grouped.has(key)) {
      grouped.set(key, {
        ventas: emptySeries(),
        otrosIngresos: emptySeries(),
        costoVentas: emptySeries(),
        margenBruto: emptySeries(),
        gastosOp: emptySeries(),
        ebitda: emptySeries(),
      });
    }
    return grouped.get(key)!;
  };

  const add = (series: MetricSeries, amount: number, r: SourcePnlRow) => {
    const idx = monthIndex.get(r.period);
    if (idx !== undefined) series.months[idx] += amount;
    if (isYtd(r)) series.ytd += amount;
  };

  const groupKey = (r: SourcePnlRow) => {
    if (groupBy === "bu")       return r.ccLevel1 || "Sin BU";
    if (groupBy === "vertical") return r.ccLevel2 || "Sin Vertical";
    if (groupBy === "area")     return r.ccLevel2 || r.ccLevel1 || "Sin Area";
    return r.costCenter || "Sin Centro de Costo";
  };

  for (const r of rows) {
    if (section === "habitual"   && isSpecialRow(r)) continue;
    if (section === "especiales" && !isSpecialRow(r)) continue;

    const item = ensure(groupKey(r));

    const isVenta       = r.level2.startsWith("1. Ingresos") && r.account !== "Ingresos Diferidos" && r.account !== "Otros Ingresos-Egresos";
    const isOtroIngreso = r.account === "Ingresos Diferidos" || r.account === "Otros Ingresos-Egresos";
    const isCostoVentas = (RRHH_ACCOUNTS.has(r.account) && !isCorpCC(r)) || r.level3 === "2.2 Costos Directos" || r.account === "Diferencia de Cambio";
    const isGastoOp     = (RRHH_ACCOUNTS.has(r.account) && isCorpCC(r)) || (r.level3 === "2.3 Gastos de Estructura" && r.account !== "Diferencia de Cambio") || r.level3 === "2.3 Gastos de Estructura Tec" || r.level3 === "2.4 Gastos de Comercializacion" || r.level3 === "2.5 Impuestos";

    if (isVenta)       add(item.ventas,       r.amount, r);
    if (isOtroIngreso) add(item.otrosIngresos, r.amount, r);
    if (isCostoVentas) add(item.costoVentas,  r.amount, r);
    if (isGastoOp)     add(item.gastosOp,     r.amount, r);
  }

  const out = [...grouped.entries()].map(([group, v]) => {
    const subtotalIngresos = {
      months: v.ventas.months.map((n, i) => n + v.otrosIngresos.months[i]),
      ytd: v.ventas.ytd + v.otrosIngresos.ytd,
    };
    v.margenBruto = { months: subtotalIngresos.months.map((n, i) => n + v.costoVentas.months[i]), ytd: subtotalIngresos.ytd + v.costoVentas.ytd };
    v.ebitda      = { months: v.margenBruto.months.map((n, i) => n + v.gastosOp.months[i]), ytd: v.margenBruto.ytd + v.gastosOp.ytd };
    return { group, ...v };
  });
  out.sort((a, b) => Math.abs(b.ebitda.ytd) - Math.abs(a.ebitda.ytd));

  return {
    periods: { month: currentPeriod, quarter: currentQuarter, ytd: `${year} YTD` },
    monthLabels,
    rows: out,
  };
};

// ─── buildUnitCostCenterBreakdown ─────────────────────────────────────────────

export const buildUnitCostCenterBreakdown = (
  groupBy: "bu" | "vertical" | "area" | "cc",
  group: string,
  section: "habitual" | "especiales" | "all",
  sourceRows?: SourcePnlRow[]
) => {
  const rows = sourceRows ?? loadSourceRows();
  const periods = [...new Set(rows.map((r) => r.period))].filter(Boolean).sort();
  const currentPeriod = periods[periods.length - 1] ?? "";
  const year = currentPeriod.split("-")[0] ?? "";
  const currentQuarter = rows.find((r) => r.period === currentPeriod)?.quarter ?? "";

  const isYtd    = (r: SourcePnlRow) => r.period.startsWith(`${year}-`) && r.period <= currentPeriod;
  const isCorpCC = (r: SourcePnlRow) => isCorpCostCenter(r.costCenter);

  const keyFor = (r: SourcePnlRow) => {
    if (groupBy === "bu")       return r.ccLevel1 || "Sin BU";
    if (groupBy === "vertical") return r.ccLevel2 || "Sin Vertical";
    if (groupBy === "area")     return r.ccLevel2 || r.ccLevel1 || "Sin Area";
    return r.costCenter || "Sin Centro de Costo";
  };

  const monthLabels = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const monthIndex  = new Map(monthLabels.map((m, i) => [m, i]));
  const emptySeries = (): MetricSeries => ({ months: Array.from({ length: 12 }, () => 0), ytd: 0 });

  type GroupBucket = {
    ventas: MetricSeries;
    otrosIngresos: MetricSeries;
    costoVentas: MetricSeries;
    margenBruto: MetricSeries;
    gastosOp: MetricSeries;
    ebitda: MetricSeries;
  };
  const grouped = new Map<string, GroupBucket>();

  const ensure = (key: string): GroupBucket => {
    if (!grouped.has(key)) {
      grouped.set(key, {
        ventas: emptySeries(),
        otrosIngresos: emptySeries(),
        costoVentas: emptySeries(),
        margenBruto: emptySeries(),
        gastosOp: emptySeries(),
        ebitda: emptySeries(),
      });
    }
    return grouped.get(key)!;
  };

  const add = (series: MetricSeries, amount: number, r: SourcePnlRow) => {
    const idx = monthIndex.get(r.period);
    if (idx !== undefined) series.months[idx] += amount;
    if (isYtd(r)) series.ytd += amount;
  };

  for (const r of rows) {
    if (keyFor(r) !== group)                         continue;
    if (section === "habitual"   && isSpecialRow(r)) continue;
    if (section === "especiales" && !isSpecialRow(r)) continue;

    const ccKey = r.costCenter || "Sin Centro de Costo";
    const item  = ensure(ccKey);

    const isVenta       = r.level2.startsWith("1. Ingresos") && r.account !== "Ingresos Diferidos" && r.account !== "Otros Ingresos-Egresos";
    const isOtroIngreso = r.account === "Ingresos Diferidos" || r.account === "Otros Ingresos-Egresos";
    const isCostoVentas = (RRHH_ACCOUNTS.has(r.account) && !isCorpCC(r)) || r.level3 === "2.2 Costos Directos" || r.account === "Diferencia de Cambio";
    const isGastoOp     = (RRHH_ACCOUNTS.has(r.account) && isCorpCC(r)) || (r.level3 === "2.3 Gastos de Estructura" && r.account !== "Diferencia de Cambio") || r.level3 === "2.3 Gastos de Estructura Tec" || r.level3 === "2.4 Gastos de Comercializacion" || r.level3 === "2.5 Impuestos";

    if (isVenta)       add(item.ventas,      r.amount, r);
    if (isOtroIngreso) add(item.otrosIngresos, r.amount, r);
    if (isCostoVentas) add(item.costoVentas, r.amount, r);
    if (isGastoOp)     add(item.gastosOp,    r.amount, r);
  }

  const out = [...grouped.entries()].map(([costCenter, v]) => {
    const subtotalIngresos = {
      months: v.ventas.months.map((n, i) => n + v.otrosIngresos.months[i]),
      ytd: v.ventas.ytd + v.otrosIngresos.ytd,
    };
    v.margenBruto = { months: subtotalIngresos.months.map((n, i) => n + v.costoVentas.months[i]), ytd: subtotalIngresos.ytd + v.costoVentas.ytd };
    v.ebitda      = { months: v.margenBruto.months.map((n, i) => n + v.gastosOp.months[i]), ytd: v.margenBruto.ytd + v.gastosOp.ytd };
    return { costCenter, ...v };
  });
  out.sort((a, b) => Math.abs(b.ebitda.ytd) - Math.abs(a.ebitda.ytd));

  return {
    unit: group,
    periods: { month: currentPeriod, quarter: currentQuarter, ytd: `${year} YTD` },
    monthLabels,
    rows: out,
  };
};

// ─── buildPnlBuMatrix ─────────────────────────────────────────────────────────

export const buildPnlBuMatrix = (
  scope: "month" | "quarter" | "ytd",
  section: "habitual" | "especiales" | "all",
  sourceRows?: SourcePnlRow[]
) => {
  const source  = sourceRows ?? loadSourceRows();
  const buList  = buildBusinessBreakdown("bu", section, source).rows.map((row) => row.group);
  const unitByBu = buList.map((bu) => ({ bu, unit: buildUnitPnl("bu", bu, section, source) }));
  const templateRows = unitByBu[0]?.unit.rows ?? [];

  const rows = templateRows.map((tpl) => {
    const values: Record<string, number> = {};
    let total = 0;
    for (const u of unitByBu) {
      const row   = u.unit.rows.find((r) => r.id === tpl.id);
      const value = row ? row[scope] : 0;
      values[u.bu] = value;
      total += value;
    }
    return { id: tpl.id, label: tpl.label, level: tpl.level, kind: tpl.kind, values, total };
  });

  return { scope, section, columns: buList, rows };
};

// ─── buildUnitPnlCcMatrix ─────────────────────────────────────────────────────

export const buildUnitPnlCcMatrix = (
  groupBy: "bu" | "vertical" | "area" | "cc",
  group: string,
  section: "habitual" | "especiales" | "all",
  scope: "month" | "quarter" | "ytd",
  sourceRows?: SourcePnlRow[]
) => {
  const rows = sourceRows ?? loadSourceRows();

  const keyFor = (r: SourcePnlRow) => {
    if (groupBy === "bu")       return r.ccLevel1 || "Sin BU";
    if (groupBy === "vertical") return r.ccLevel2 || "Sin Vertical";
    if (groupBy === "area")     return r.ccLevel2 || r.ccLevel1 || "Sin Area";
    return r.costCenter || "Sin Centro de Costo";
  };

  const filtered = rows.filter((r) => {
    if (keyFor(r) !== group)                          return false;
    if (section === "habitual"   && isSpecialRow(r))  return false;
    if (section === "especiales" && !isSpecialRow(r)) return false;
    return true;
  });

  const ccColumns = [...new Set(filtered.map((r) => r.costCenter || "Sin Centro de Costo"))].filter(Boolean).sort();
  const unitByCc  = ccColumns.map((cc) => ({ cc, unit: buildUnitPnl("cc", cc, section, sourceRows) }));
  const templateRows = unitByCc[0]?.unit.rows ?? [];

  const matrixRows = templateRows.map((tpl) => {
    const values: Record<string, number> = {};
    let total = 0;
    for (const u of unitByCc) {
      const row   = u.unit.rows.find((r) => r.id === tpl.id);
      const value = row ? row[scope] : 0;
      values[u.cc] = value;
      total += value;
    }
    return { id: tpl.id, label: tpl.label, level: tpl.level, kind: tpl.kind, values, total };
  });

  return { unit: group, scope, section, columns: ccColumns, rows: matrixRows };
};

// Silence unused import warning (lower is imported via classify but also needed here)
void lower;
