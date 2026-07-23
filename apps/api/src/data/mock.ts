import type { DrillRow, Kpi } from "../types/index.js";

export const kpis: Kpi[] = [
  { title: "Ventas",          value: 243500000, deltaPct:  6.4 },
  { title: "Margen Bruto",    value: 121300000, deltaPct: -2.1 },
  { title: "EBITDA",          value:  48700000, deltaPct:  3.8 },
  { title: "Resultado Neto",  value:  35200000, deltaPct:  4.2 },
];

export const overviewChart = [
  { month: "Jul", habitual: 44,  especiales:  -41 },
  { month: "Ago", habitual: 42,  especiales:  -29 },
  { month: "Sep", habitual: 47,  especiales:   -6 },
  { month: "Oct", habitual: 51,  especiales:  -48 },
  { month: "Nov", habitual: 58,  especiales: -137 },
  { month: "Dic", habitual: 63,  especiales:  -15 },
];

export const drillByLine: Record<string, DrillRow[]> = {
  "gastos-especiales": [
    {
      id: "d1", date: "2025-11-14", document: "AG-1290",
      account: "Gastos Legales - Notaria", costCenter: "Servicios Especiales",
      detail: "Honorarios legales especiales", amount: -137246181.5, adjustedAmount: -137246181.5,
    },
    {
      id: "d2", date: "2025-10-21", document: "AG-1218",
      account: "Gastos Legales - Notaria", costCenter: "Servicios Especiales",
      detail: "Acuerdo legal extraordinario", amount: -47730509.5, adjustedAmount: -47730509.5,
    },
  ],
  "costo-habitual": [
    {
      id: "d3", date: "2025-11-30", document: "DV-889",
      account: "Sueldos", costCenter: "01_STAFFING",
      detail: "Devengamiento noviembre", amount: -32800000, adjustedAmount: -32800000,
    },
    {
      id: "d4", date: "2025-11-30", document: "DV-890",
      account: "Cargas Sociales", costCenter: "01_STAFFING",
      detail: "Cargas noviembre", amount: -6790000, adjustedAmount: -6790000,
    },
  ],
};
