import type { JournalLeg, SourcePnlRow } from "../types/index.js";
import { lower } from "./helpers.js";

export const RRHH_ACCOUNTS = new Set([
  "ART", "Cargas Sindicales", "Cargas Sociales", "Obra Social - Prepaga",
  "RRHH - Gastos Bienestar", "S.A.C.", "S.A.C. Provisión Rdo",
  "Seguro de vida obligatorio", "Servicios RRHH Proyectos", "Servicios Reclutamiento",
  "Sueldos", "Sueldos_Tercerizados", "Beneficio LEC",
]);

export const isCorpCostCenter = (costCenter: string): boolean => {
  const cc = lower(costCenter);
  return (
    cc.includes("corporativo") ||
    cc.includes("administracion") ||
    cc.includes("finanzas") ||
    cc.includes("infraestructura") ||
    cc.includes("gcba")
  );
};

export const isSpecialRow = (r: SourcePnlRow): boolean =>
  lower(r.ccLevel1) === "z_especiales";

export const classifySourceToLineId = (r: SourcePnlRow): string | null => {
  if (isSpecialRow(r) && r.level2.startsWith("1. Ingresos")) return "se-ing";
  if (isSpecialRow(r) && r.level2.startsWith("2. Egreso"))   return "se-eg";
  if (isSpecialRow(r)) return null;

  if (r.level2.startsWith("1. Ingresos")) {
    if (r.account === "Ingresos Diferidos")     return "ing-dif";
    if (r.account === "Otros Ingresos-Egresos") return "otros-ing";
    return "ventas";
  }
  if (RRHH_ACCOUNTS.has(r.account) && !isCorpCostCenter(r.costCenter)) return "rrhh-dir";
  if (r.level3 === "2.2 Costos Directos")                               return "cost-dir";
  if (r.account === "Diferencia de Cambio")                             return "dif-cambio-op";
  if (RRHH_ACCOUNTS.has(r.account) && isCorpCostCenter(r.costCenter))  return "rrhh-est";
  if (r.level3 === "2.3 Gastos de Estructura" && r.account !== "Diferencia de Cambio") return "gast-est";
  if (r.level3 === "2.3 Gastos de Estructura Tec")                      return "gast-tec";
  if (r.level3 === "2.4 Gastos de Comercializacion")                    return "gast-com";
  if (r.level3 === "2.5 Impuestos")                                     return "imp-op";
  if (r.level3 === "2.7 One time costs")                                return "one-time";
  if (r.level2.startsWith("3. Resultados Financiero"))                  return "fin";
  return null;
};

export const mapJournalLegToLineId = (rows: SourcePnlRow[], leg: JournalLeg): string | null => {
  const exact = rows.find(
    (r) => r.account === leg.account && r.costCenter === leg.costCenter && r.period === leg.period
  );
  if (exact) return classifySourceToLineId(exact);
  const fallback = rows.find((r) => r.account === leg.account && r.costCenter === leg.costCenter);
  return fallback ? classifySourceToLineId(fallback) : null;
};

export const isIncomeLine = (lineId: string): boolean =>
  new Set(["ventas", "ing-dif", "otros-ing", "se-ing"]).has(lineId);

export const signedImpactBySide = (
  lineId: string,
  side: "debit" | "credit",
  amount: number
): number => {
  if (isIncomeLine(lineId)) return side === "credit" ? amount : -amount;
  return side === "debit" ? -amount : amount;
};

/** Shared predicate map for P&L line filtering. Used in drill and explorer routes. */
export const pnlLinePredicates: Record<string, (r: SourcePnlRow) => boolean> = {
  ventas:         (r) => r.level2.startsWith("1. Ingresos") && r.account !== "Ingresos Diferidos" && r.account !== "Otros Ingresos-Egresos" && !isSpecialRow(r),
  "ing-dif":      (r) => r.account === "Ingresos Diferidos" && !isSpecialRow(r),
  "otros-ing":    (r) => r.account === "Otros Ingresos-Egresos" && !isSpecialRow(r),
  "sub-ing":      (r) => !isSpecialRow(r) && (
    (r.level2.startsWith("1. Ingresos") && r.account !== "Ingresos Diferidos" && r.account !== "Otros Ingresos-Egresos")
    || r.account === "Ingresos Diferidos"
    || r.account === "Otros Ingresos-Egresos"
  ),
  "rrhh-dir":     (r) => RRHH_ACCOUNTS.has(r.account) && !isCorpCostCenter(r.costCenter) && !isSpecialRow(r),
  "cost-dir":     (r) => r.level3 === "2.2 Costos Directos" && !isSpecialRow(r),
  "dif-cambio-op":(r) => r.account === "Diferencia de Cambio" && !isSpecialRow(r),
  "sub-cv":       (r) => !isSpecialRow(r) && (
    (RRHH_ACCOUNTS.has(r.account) && !isCorpCostCenter(r.costCenter))
    || r.level3 === "2.2 Costos Directos"
    || r.account === "Diferencia de Cambio"
  ),
  margen:          (r) => !isSpecialRow(r) && (
    r.level2.startsWith("1. Ingresos")
    || (RRHH_ACCOUNTS.has(r.account) && !isCorpCostCenter(r.costCenter))
    || r.level3 === "2.2 Costos Directos"
    || r.account === "Diferencia de Cambio"
  ),
  "rrhh-est":     (r) => RRHH_ACCOUNTS.has(r.account) && isCorpCostCenter(r.costCenter) && !isSpecialRow(r),
  "gast-est":     (r) => r.level3 === "2.3 Gastos de Estructura" && r.account !== "Diferencia de Cambio" && !isSpecialRow(r),
  "gast-tec":     (r) => r.level3 === "2.3 Gastos de Estructura Tec" && !isSpecialRow(r),
  "gast-com":     (r) => r.level3 === "2.4 Gastos de Comercializacion" && !isSpecialRow(r),
  "imp-op":       (r) => r.level3 === "2.5 Impuestos" && !isSpecialRow(r),
  "sub-go":       (r) => !isSpecialRow(r) && (
    (RRHH_ACCOUNTS.has(r.account) && isCorpCostCenter(r.costCenter))
    || (r.level3 === "2.3 Gastos de Estructura" && r.account !== "Diferencia de Cambio")
    || r.level3 === "2.3 Gastos de Estructura Tec"
    || r.level3 === "2.4 Gastos de Comercializacion"
    || r.level3 === "2.5 Impuestos"
  ),
  "ebitda-h":      (r) => !isSpecialRow(r) && (
    r.level2.startsWith("1. Ingresos")
    || (RRHH_ACCOUNTS.has(r.account) && !isCorpCostCenter(r.costCenter))
    || r.level3 === "2.2 Costos Directos"
    || r.account === "Diferencia de Cambio"
    || (RRHH_ACCOUNTS.has(r.account) && isCorpCostCenter(r.costCenter))
    || (r.level3 === "2.3 Gastos de Estructura" && r.account !== "Diferencia de Cambio")
    || r.level3 === "2.3 Gastos de Estructura Tec"
    || r.level3 === "2.4 Gastos de Comercializacion"
    || r.level3 === "2.5 Impuestos"
  ),
  "one-time":     (r) => r.level3 === "2.7 One time costs" && !isSpecialRow(r),
  "fin":          (r) => r.level2.startsWith("3. Resultados Financiero") && !isSpecialRow(r),
  "se-ing":       (r) => r.level2.startsWith("1. Ingresos") && isSpecialRow(r),
  "se-eg":        (r) => r.level2.startsWith("2. Egreso") && isSpecialRow(r),
  "se-ebitda":     (r) => isSpecialRow(r) && (r.level2.startsWith("1. Ingresos") || r.level2.startsWith("2. Egreso")),
  net:             (r) => (
    (!isSpecialRow(r) && (
      r.level2.startsWith("1. Ingresos")
      || (RRHH_ACCOUNTS.has(r.account) && !isCorpCostCenter(r.costCenter))
      || r.level3 === "2.2 Costos Directos"
      || r.account === "Diferencia de Cambio"
      || (RRHH_ACCOUNTS.has(r.account) && isCorpCostCenter(r.costCenter))
      || (r.level3 === "2.3 Gastos de Estructura" && r.account !== "Diferencia de Cambio")
      || r.level3 === "2.3 Gastos de Estructura Tec"
      || r.level3 === "2.4 Gastos de Comercializacion"
      || r.level3 === "2.5 Impuestos"
      || r.level3 === "2.7 One time costs"
      || r.level2.startsWith("3. Resultados Financiero")
    ))
    || (isSpecialRow(r) && (r.level2.startsWith("1. Ingresos") || r.level2.startsWith("2. Egreso")))
  ),
};
