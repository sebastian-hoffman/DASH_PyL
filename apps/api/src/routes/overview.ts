import { Router } from "express";
import { z } from "zod";
import { kpis } from "../data/mock.js";
import { loadSourceRowsByYear } from "../data/loader.js";
import type { RevenueChartPoint, SourcePnlRow } from "../types/index.js";
import { lower } from "../lib/helpers.js";
import { RRHH_ACCOUNTS, isCorpCostCenter, isSpecialRow } from "../lib/classify.js";
import {
  filterRowsByLevel1,
  filterRowsByPeriods,
  parseLevel1Param,
  parsePeriodsParam,
} from "../lib/queryFilters.js";

const router = Router();

const TOP_DIMENSIONS = 5;

const formatMonthLabel = (period: string) => {
  const [year, month] = period.split("-");
  const monthIndex = Number(month) - 1;
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return period;
  return `${monthNames[monthIndex]} ${year.slice(-2)}`;
};

const buildOverviewChart = (source: SourcePnlRow[]) => {
  const periods = [...new Set(source.map((row) => row.period))].filter(Boolean).sort();

  // Pre-filter by period for efficiency (don't iterate all 2817 rows for each period)
  const rowsByPeriod = new Map<string, SourcePnlRow[]>();
  for (const row of source) {
    const p = row.period;
    if (!rowsByPeriod.has(p)) rowsByPeriod.set(p, []);
    rowsByPeriod.get(p)!.push(row);
  }

  return periods.map((period) => {
    let habitual = 0;
    const periodRows = rowsByPeriod.get(period) || [];

    for (const row of periodRows) {
      if (isSpecialRow(row)) continue;

      const isVentas = row.level2.startsWith("1. Ingresos")
        && row.account !== "Ingresos Diferidos"
        && row.account !== "Otros Ingresos-Egresos";
      const isIngresosDiferidos = row.account === "Ingresos Diferidos";
      const isOtrosIngresos = row.account === "Otros Ingresos-Egresos";
      const isRrhhDirecto = RRHH_ACCOUNTS.has(row.account) && !isCorpCostCenter(row.costCenter);
      const isCostosDirectos = row.level3 === "2.2 Costos Directos";
      const isDifCambioOperativa = row.account === "Diferencia de Cambio";
      const isRrhhEstructura = RRHH_ACCOUNTS.has(row.account) && isCorpCostCenter(row.costCenter);
      const isGastoEstructura = row.level3 === "2.3 Gastos de Estructura" && row.account !== "Diferencia de Cambio";
      const isGastoEstructuraTec = row.level3 === "2.3 Gastos de Estructura Tec";
      const isGastoComercial = row.level3 === "2.4 Gastos de Comercializacion";
      const isImpuestoOperativo = row.level3 === "2.5 Impuestos";

      if (
        isVentas
        || isIngresosDiferidos
        || isOtrosIngresos
        || isRrhhDirecto
        || isCostosDirectos
        || isDifCambioOperativa
        || isRrhhEstructura
        || isGastoEstructura
        || isGastoEstructuraTec
        || isGastoComercial
        || isImpuestoOperativo
      ) {
        habitual += row.amount;
      }
    }

    return {
      month: formatMonthLabel(period),
      habitual,
    };
  });
};

const buildRevenueChart = (allSource: SourcePnlRow[]) => {
  const source = allSource.filter((row) => {
    return row.level2.startsWith("1. Ingresos")
      && row.account !== "Ingresos Diferidos"
      && row.account !== "Otros Ingresos-Egresos"
      && lower(row.ccLevel1) !== "z_especiales";
  });

  const periods = [...new Set(source.map((row) => row.period))].filter(Boolean).sort();
  const totalsByDimension = new Map<string, number>();

  // Pre-filter by period for efficiency
  const rowsByPeriod = new Map<string, SourcePnlRow[]>();
  for (const row of source) {
    const p = row.period;
    if (!rowsByPeriod.has(p)) rowsByPeriod.set(p, []);
    rowsByPeriod.get(p)!.push(row);
  }

  for (const row of source) {
    const dimension = row.ccLevel1 || "Sin Nivel 1";
    totalsByDimension.set(dimension, (totalsByDimension.get(dimension) ?? 0) + row.amount);
  }

  const dimensions = [...totalsByDimension.entries()]
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .map(([dimension]) => dimension);

  const primaryDimensions = dimensions.slice(0, TOP_DIMENSIONS);
  const overflowDimensions = new Set(dimensions.slice(TOP_DIMENSIONS));
  const chartRows = new Map<string, RevenueChartPoint>();

  for (const period of periods) {
    const point: RevenueChartPoint = { month: period, total: 0 };
    for (const dimension of primaryDimensions) {
      point[dimension] = 0;
    }
    if (overflowDimensions.size > 0) {
      point.Otros = 0;
    }
    chartRows.set(period, point);
  }

  for (const period of periods) {
    const periodRows = rowsByPeriod.get(period) || [];
    const point = chartRows.get(period);
    if (!point) continue;

    for (const row of periodRows) {
      const dimension = row.ccLevel1 || "Sin Nivel 1";
      const bucket = overflowDimensions.has(dimension) ? "Otros" : dimension;
      point[bucket] = Number(point[bucket] ?? 0) + row.amount;
      point.total += row.amount;
    }
  }

  return {
    dimensions: overflowDimensions.size > 0 ? [...primaryDimensions, "Otros"] : primaryDimensions,
    rows: periods.map((period) => chartRows.get(period) ?? { month: period, total: 0 }),
  };
};

router.get("/overview", (req, res) => {
  const { year, level1 } = z.object({
    year: z.string().regex(/^\d{4}$/).default("2025"),
    level1: z.string().optional(),
    periods: z.string().optional(),
  }).parse(req.query);
  const src = filterRowsByPeriods(
    filterRowsByLevel1(loadSourceRowsByYear(year), parseLevel1Param(level1)),
    parsePeriodsParam(req.query.periods)
  );
  res.json({ kpis, chart: buildOverviewChart(src), revenueChart: buildRevenueChart(src) });
});

export default router;
