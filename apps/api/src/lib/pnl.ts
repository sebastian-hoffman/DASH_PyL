import { loadSourceRows } from "../data/loader.js";
import { adjustments, journalAdjustments } from "../store/adjustments.js";
import type { PnlStructuredRow, SourcePnlRow, Triple } from "../types/index.js";
import {
  RRHH_ACCOUNTS,
  isCorpCostCenter,
  isSpecialRow,
  mapJournalLegToLineId,
  signedImpactBySide,
} from "./classify.js";
import { addTriple, asTriple, lower } from "./helpers.js";

// ─── buildStructuredPnl ───────────────────────────────────────────────────────

export const buildStructuredPnl = (sourceRows?: SourcePnlRow[]) => {
  const rows = sourceRows ?? loadSourceRows();
  const periods = [...new Set(rows.map((r) => r.period))].filter(Boolean).sort();
  const currentPeriod = periods[periods.length - 1] ?? "";
  const year = currentPeriod.split("-")[0] ?? "";
  const currentQuarter = rows.find((r) => r.period === currentPeriod)?.quarter ?? "";

  const isCurrent = (r: SourcePnlRow) => r.period === currentPeriod;
  const isQuarter = (r: SourcePnlRow) => r.quarter === currentQuarter;
  const isYtd     = (r: SourcePnlRow) => r.period.startsWith(`${year}-`) && r.period <= currentPeriod;
  const isCorpCC  = (r: SourcePnlRow) => isCorpCostCenter(r.costCenter);

  const sumBy = (predicate: (r: SourcePnlRow) => boolean): Triple => {
    let month = 0, quarter = 0, ytd = 0;
    for (const r of rows) {
      if (!predicate(r)) continue;
      if (isCurrent(r)) month   += r.amount;
      if (isQuarter(r)) quarter += r.amount;
      if (isYtd(r))     ytd     += r.amount;
    }
    return { month, quarter, ytd };
  };

  const ventas            = sumBy((r) => !isSpecialRow(r) && r.level2.startsWith("1. Ingresos") && r.account !== "Ingresos Diferidos" && r.account !== "Otros Ingresos-Egresos");
  const ingresosDiferidos = sumBy((r) => !isSpecialRow(r) && r.account === "Ingresos Diferidos");
  const otrosIngresos     = sumBy((r) => !isSpecialRow(r) && r.account === "Otros Ingresos-Egresos");
  const subtotalIngresos  = addTriple(addTriple(ventas, ingresosDiferidos), otrosIngresos);

  const rrhhDirecto         = sumBy((r) => !isSpecialRow(r) && RRHH_ACCOUNTS.has(r.account) && !isCorpCC(r));
  const costosDirectos      = sumBy((r) => !isSpecialRow(r) && r.level3 === "2.2 Costos Directos");
  const difCambioOperativa  = sumBy((r) => !isSpecialRow(r) && r.account === "Diferencia de Cambio");
  const subtotalCostoVentas = addTriple(addTriple(rrhhDirecto, costosDirectos), difCambioOperativa);

  const margenBruto = addTriple(subtotalIngresos, subtotalCostoVentas);

  const rrhhEstructura      = sumBy((r) => !isSpecialRow(r) && RRHH_ACCOUNTS.has(r.account) && isCorpCC(r));
  const gastosEstructura    = sumBy((r) => !isSpecialRow(r) && r.level3 === "2.3 Gastos de Estructura" && r.account !== "Diferencia de Cambio");
  const gastosEstructuraTec = sumBy((r) => !isSpecialRow(r) && r.level3 === "2.3 Gastos de Estructura Tec");
  const gastosComercial     = sumBy((r) => !isSpecialRow(r) && r.level3 === "2.4 Gastos de Comercializacion");
  const impuestosOperativos = sumBy((r) => !isSpecialRow(r) && r.level3 === "2.5 Impuestos");
  const subtotalGastosOp    = addTriple(
    addTriple(addTriple(rrhhEstructura, gastosEstructura), addTriple(gastosEstructuraTec, gastosComercial)),
    impuestosOperativos
  );

  const ebitdaHabitual = addTriple(margenBruto, subtotalGastosOp);

  const ingresosEspeciales = sumBy((r) => isSpecialRow(r) && r.level2.startsWith("1. Ingresos"));
  const egresosEspeciales  = sumBy((r) => isSpecialRow(r) && r.level2.startsWith("2. Egreso"));
  const ebitdaEspeciales   = addTriple(ingresosEspeciales, egresosEspeciales);

  const oneTime       = sumBy((r) => !isSpecialRow(r) && r.level3 === "2.7 One time costs");
  const financiero    = sumBy((r) => !isSpecialRow(r) && r.level2.startsWith("3. Resultados Financiero"));
  const resultadoNeto = addTriple(addTriple(ebitdaHabitual, ebitdaEspeciales), addTriple(oneTime, financiero));

  // Adjustment helpers ─────────────────────────────────────────────────────────
  const quarterByPeriod = new Map<string, string>();
  for (const r of rows) {
    if (r.period && r.quarter && !quarterByPeriod.has(r.period)) {
      quarterByPeriod.set(r.period, r.quarter);
    }
  }

  const periodMatchesTarget = (period: string, target: "month" | "quarter" | "ytd") => {
    if (!period) return false;
    if (target === "month")   return period === currentPeriod;
    if (target === "quarter") return quarterByPeriod.get(period) === currentQuarter;
    return period.startsWith(`${year}-`) && period <= currentPeriod;
  };

  const sumAdjustments = (lineId: string, target: "month" | "quarter" | "ytd") => {
    const legacy = adjustments
      .filter((a) => a.lineId === lineId && (a.target === "all" || a.target === target))
      .reduce((acc, a) => acc + a.amount, 0);

    let journal = 0;
    for (const adj of journalAdjustments) {
      const debitLine  = mapJournalLegToLineId(rows, adj.debit);
      const creditLine = mapJournalLegToLineId(rows, adj.credit);
      if (debitLine  === lineId && periodMatchesTarget(adj.debit.period,  target)) journal += signedImpactBySide(lineId, "debit",  adj.amount);
      if (creditLine === lineId && periodMatchesTarget(adj.credit.period, target)) journal += signedImpactBySide(lineId, "credit", adj.amount);
    }
    return legacy + journal;
  };

  const row = (
    id: string, label: string, level: number,
    kind: PnlStructuredRow["kind"], t: Triple, hasAdjustments = false
  ): PnlStructuredRow => {
    const mAdj = sumAdjustments(id, "month");
    const qAdj = sumAdjustments(id, "quarter");
    const yAdj = sumAdjustments(id, "ytd");
    return {
      id, label, level, kind,
      month:   t.month   + mAdj,
      quarter: t.quarter + qAdj,
      ytd:     t.ytd     + yAdj,
      hasAdjustments: hasAdjustments || mAdj !== 0 || qAdj !== 0 || yAdj !== 0,
    };
  };

  return {
    periods: { month: currentPeriod, quarter: currentQuarter, ytd: `${year} YTD` },
    rows: [
      row("sec-ing",        "Ingresos",                           0, "section",  asTriple()),
      row("ventas",         "Ventas",                             1, "detail",   ventas),
      row("ing-dif",        "Ingresos Diferidos (ajuste)",        1, "detail",   ingresosDiferidos, true),
      row("otros-ing",      "Otros Ingresos",                     1, "detail",   otrosIngresos),
      row("sub-ing",        "Subtotal Ingresos",                  0, "subtotal", subtotalIngresos),

      row("sec-cv",         "Costo de Ventas",                    0, "section",  asTriple()),
      row("rrhh-dir",       "RRHH Directo",                       1, "detail",   rrhhDirecto),
      row("cost-dir",       "Costos Directos",                    1, "detail",   costosDirectos),
      row("dif-cambio-op",  "Diferencia de Cambio Operativa",     1, "detail",   difCambioOperativa),
      row("sub-cv",         "Subtotal Costo de Ventas",           0, "subtotal", subtotalCostoVentas),

      row("margen",         "Margen Bruto",                       0, "kpi",      margenBruto),

      row("sec-go",         "Gastos Operativos",                  0, "section",  asTriple()),
      row("rrhh-est",       "RRHH Estructura",                    1, "detail",   rrhhEstructura),
      row("gast-est",       "Gastos de Estructura",               1, "detail",   gastosEstructura),
      row("gast-tec",       "Gastos de Estructura Tecnología",    1, "detail",   gastosEstructuraTec),
      row("gast-com",       "Gastos de Comercialización",         1, "detail",   gastosComercial),
      row("imp-op",         "Impuestos Operativos",               1, "detail",   impuestosOperativos),
      row("sub-go",         "Subtotal Gastos Operativos",         0, "subtotal", subtotalGastosOp),

      row("ebitda-h",       "EBITDA Negocio Habitual",            0, "kpi",      ebitdaHabitual),

      row("sec-se",         "Servicios Especiales",               0, "section",  asTriple()),
      row("se-ing",         "Ingresos Servicios Especiales",      1, "detail",   ingresosEspeciales),
      row("se-eg",          "Egresos Servicios Especiales",       1, "detail",   egresosEspeciales),
      row("se-ebitda",      "EBITDA Servicios Especiales",        0, "kpi",      ebitdaEspeciales),

      row("one-time",       "One Time Costs",                     0, "detail",   oneTime),
      row("fin",            "Resultado Financiero",               0, "detail",   financiero),
      row("net",            "Resultado Neto",                     0, "kpi",      resultadoNeto),
    ],
  };
};

// ─── buildUnitPnl ─────────────────────────────────────────────────────────────

export const buildUnitPnl = (
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

  const isCurrent = (r: SourcePnlRow) => r.period === currentPeriod;
  const isQuarter = (r: SourcePnlRow) => r.quarter === currentQuarter;
  const isYtd     = (r: SourcePnlRow) => r.period.startsWith(`${year}-`) && r.period <= currentPeriod;
  const isCorpCC  = (r: SourcePnlRow) => isCorpCostCenter(r.costCenter);

  const keyFor = (r: SourcePnlRow) => {
    if (groupBy === "bu")       return r.ccLevel1  || "Sin BU";
    if (groupBy === "vertical") return r.ccLevel2  || "Sin Vertical";
    if (groupBy === "area")     return r.ccLevel2  || r.ccLevel1 || "Sin Area";
    return r.costCenter || "Sin Centro de Costo";
  };

  const source = rows.filter((r) => {
    if (keyFor(r) !== group)                          return false;
    if (section === "habitual"  && isSpecialRow(r))   return false;
    if (section === "especiales" && !isSpecialRow(r)) return false;
    return true;
  });

  const sumBy = (predicate: (r: SourcePnlRow) => boolean): Triple => {
    let month = 0, quarter = 0, ytd = 0;
    for (const r of source) {
      if (!predicate(r)) continue;
      if (isCurrent(r)) month   += r.amount;
      if (isQuarter(r)) quarter += r.amount;
      if (isYtd(r))     ytd     += r.amount;
    }
    return { month, quarter, ytd };
  };

  const ventas            = sumBy((r) => !isSpecialRow(r) && r.level2.startsWith("1. Ingresos") && r.account !== "Ingresos Diferidos" && r.account !== "Otros Ingresos-Egresos");
  const ingresosDiferidos = sumBy((r) => !isSpecialRow(r) && r.account === "Ingresos Diferidos");
  const otrosIngresos     = sumBy((r) => !isSpecialRow(r) && r.account === "Otros Ingresos-Egresos");
  const subtotalIngresos  = addTriple(addTriple(ventas, ingresosDiferidos), otrosIngresos);

  const rrhhDirecto         = sumBy((r) => !isSpecialRow(r) && RRHH_ACCOUNTS.has(r.account) && !isCorpCC(r));
  const costosDirectos      = sumBy((r) => !isSpecialRow(r) && r.level3 === "2.2 Costos Directos");
  const difCambioOperativa  = sumBy((r) => !isSpecialRow(r) && r.account === "Diferencia de Cambio");
  const subtotalCostoVentas = addTriple(addTriple(rrhhDirecto, costosDirectos), difCambioOperativa);

  const margenBruto = addTriple(subtotalIngresos, subtotalCostoVentas);

  const rrhhEstructura      = sumBy((r) => !isSpecialRow(r) && RRHH_ACCOUNTS.has(r.account) && isCorpCC(r));
  const gastosEstructura    = sumBy((r) => !isSpecialRow(r) && r.level3 === "2.3 Gastos de Estructura" && r.account !== "Diferencia de Cambio");
  const gastosEstructuraTec = sumBy((r) => !isSpecialRow(r) && r.level3 === "2.3 Gastos de Estructura Tec");
  const gastosComercial     = sumBy((r) => !isSpecialRow(r) && r.level3 === "2.4 Gastos de Comercializacion");
  const impuestosOperativos = sumBy((r) => !isSpecialRow(r) && r.level3 === "2.5 Impuestos");
  const subtotalGastosOp    = addTriple(
    addTriple(addTriple(rrhhEstructura, gastosEstructura), addTriple(gastosEstructuraTec, gastosComercial)),
    impuestosOperativos
  );

  const ebitdaHabitual     = addTriple(margenBruto, subtotalGastosOp);
  const ingresosEspeciales = sumBy((r) => isSpecialRow(r) && r.level2.startsWith("1. Ingresos"));
  const egresosEspeciales  = sumBy((r) => isSpecialRow(r) && r.level2.startsWith("2. Egreso"));
  const ebitdaEspeciales   = addTriple(ingresosEspeciales, egresosEspeciales);
  const oneTime            = sumBy((r) => !isSpecialRow(r) && r.level3 === "2.7 One time costs");
  const financiero         = sumBy((r) => !isSpecialRow(r) && r.level2.startsWith("3. Resultados Financiero"));
  const resultadoNeto      = addTriple(addTriple(ebitdaHabitual, ebitdaEspeciales), addTriple(oneTime, financiero));

  const detail = (id: string, label: string, level: number, kind: PnlStructuredRow["kind"], t: Triple) =>
    ({ id, label, level, kind, ...t, hasAdjustments: false });

  return {
    periods: { month: currentPeriod, quarter: currentQuarter, ytd: `${year} YTD` },
    unit: group,
    rows: [
      detail("unit-sec-ing",       "Ingresos",                           0, "section",  asTriple()),
      detail("unit-ventas",         "Ventas",                             1, "detail",   ventas),
      detail("unit-ing-dif",        "Ingresos Diferidos (ajuste)",        1, "detail",   ingresosDiferidos),
      detail("unit-otros-ing",      "Otros Ingresos",                     1, "detail",   otrosIngresos),
      detail("unit-sub-ing",        "Subtotal Ingresos",                  0, "subtotal", subtotalIngresos),

      detail("unit-sec-cv",         "Costo de Ventas",                    0, "section",  asTriple()),
      detail("unit-rrhh-dir",       "RRHH Directo",                       1, "detail",   rrhhDirecto),
      detail("unit-cost-dir",       "Costos Directos",                    1, "detail",   costosDirectos),
      detail("unit-dif-cambio-op",  "Diferencia de Cambio Operativa",     1, "detail",   difCambioOperativa),
      detail("unit-sub-cv",         "Subtotal Costo de Ventas",           0, "subtotal", subtotalCostoVentas),

      detail("unit-margen",         "Margen Bruto",                       0, "kpi",      margenBruto),

      detail("unit-sec-go",         "Gastos Operativos",                  0, "section",  asTriple()),
      detail("unit-rrhh-est",       "RRHH Estructura",                    1, "detail",   rrhhEstructura),
      detail("unit-gast-est",       "Gastos de Estructura",               1, "detail",   gastosEstructura),
      detail("unit-gast-tec",       "Gastos de Estructura Tecnología",    1, "detail",   gastosEstructuraTec),
      detail("unit-gast-com",       "Gastos de Comercialización",         1, "detail",   gastosComercial),
      detail("unit-imp-op",         "Impuestos Operativos",               1, "detail",   impuestosOperativos),
      detail("unit-sub-go",         "Subtotal Gastos Operativos",         0, "subtotal", subtotalGastosOp),

      detail("unit-ebitda-h",       "EBITDA Negocio Habitual",            0, "kpi",      ebitdaHabitual),

      detail("unit-sec-se",         "Servicios Especiales",               0, "section",  asTriple()),
      detail("unit-se-ing",         "Ingresos Servicios Especiales",      1, "detail",   ingresosEspeciales),
      detail("unit-se-eg",          "Egresos Servicios Especiales",       1, "detail",   egresosEspeciales),
      detail("unit-se-ebitda",      "EBITDA Servicios Especiales",        0, "kpi",      ebitdaEspeciales),

      detail("unit-one-time",       "One Time Costs",                     0, "detail",   oneTime),
      detail("unit-fin",            "Resultado Financiero",               0, "detail",   financiero),
      detail("unit-net",            "Resultado Neto",                     0, "kpi",      resultadoNeto),
    ],
  };
};
