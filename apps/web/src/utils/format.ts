export const fmtCurrency = (n: number): string =>
  new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(n);

export const fmtPct = (n: number): string =>
  `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
