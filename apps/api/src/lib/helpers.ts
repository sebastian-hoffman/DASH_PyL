import type { Triple } from "../types/index.js";

export const lower = (v: string): string => v.toLowerCase();

export const addTriple = (a: Triple, b: Triple): Triple => ({
  month:   a.month   + b.month,
  quarter: a.quarter + b.quarter,
  ytd:     a.ytd     + b.ytd,
});

export const asTriple = (value = 0): Triple => ({
  month: value, quarter: value, ytd: value,
});
