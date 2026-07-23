import { Router } from "express";
import path from "node:path";
import { z } from "zod";
import { pnlExcelPath } from "../config/index.js";
import { loadSourceRowsByYear } from "../data/loader.js";
import { drillByLine } from "../data/mock.js";
import { pnlLinePredicates } from "../lib/classify.js";
import { lower } from "../lib/helpers.js";
import {
  filterRowsByLevel1,
  filterRowsByPeriods,
  parseLevel1Param,
  parsePeriodsParam,
} from "../lib/queryFilters.js";
import type { DrillRow, MatrixAxis, SourcePnlRow } from "../types/index.js";

const router = Router();

// ─── /api/pnl-dim-drill ──────────────────────────────────────────────────────

router.get("/pnl-dim-drill", (req, res) => {
  const schema = z.object({
    lineId:  z.string().min(1),
    periods: z.string().optional(),
    dim:     z.string().optional(),
    cc:      z.string().optional(),
    year:    z.string().regex(/^\d{4}$/).default("2025"),
    level1:  z.string().optional(),
    filterPeriods: z.string().optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { lineId, periods: periodsParam, dim, cc, year, level1, filterPeriods } = parsed.data;
  const allRows = filterRowsByPeriods(
    filterRowsByLevel1(loadSourceRowsByYear(year), parseLevel1Param(level1)),
    parsePeriodsParam(filterPeriods)
  );
  const allPeriods   = [...new Set(allRows.map((r) => r.period))].filter(Boolean).sort();
  const selectedPeriods = periodsParam
    ? periodsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : allPeriods;

  const basePredicate = pnlLinePredicates[lineId];
  if (!basePredicate) {
    res.json({ mode: "no-predicate", lineId, rows: [] });
    return;
  }

  const filtered = allRows.filter((r) => selectedPeriods.includes(r.period) && basePredicate(r));

  if (!dim) {
    const groups = new Map<string, number>();
    for (const r of filtered) {
      const key = r.ccLevel1 || "Sin BU";
      groups.set(key, (groups.get(key) ?? 0) + r.amount);
    }
    const rows = [...groups.entries()]
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([group, total]) => ({ group, total }));
    res.json({ mode: "by-dim", lineId, periods: selectedPeriods, rows });
    return;
  }

  const dimFiltered = filtered.filter((r) => (r.ccLevel1 || "Sin BU") === dim);
  if (!cc) {
    const byCC = new Map<string, number>();
    for (const r of dimFiltered) {
      const key = r.costCenter || "Sin CC";
      byCC.set(key, (byCC.get(key) ?? 0) + r.amount);
    }
    const rows = [...byCC.entries()]
      .map(([costCenter, total]) => ({ costCenter, total }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
    res.json({ mode: "by-cc", lineId, dim, periods: selectedPeriods, rows });
    return;
  }

  const ccFiltered = dimFiltered.filter((r) => (r.costCenter || "Sin CC") === cc);
  const byAccount  = new Map<string, number>();
  for (const r of ccFiltered) {
    byAccount.set(r.account, (byAccount.get(r.account) ?? 0) + r.amount);
  }
  const movements = [...byAccount.entries()]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 50)
    .map(([account, total], idx): DrillRow => ({
      id: `${lineId}-${dim}-${cc}-${idx}`,
      date: selectedPeriods.join(", "),
      document: "P&L",
      account,
      costCenter: cc,
      detail: lineId,
      amount: total,
      adjustedAmount: total,
    }));
  res.json({ mode: "movements", lineId, dim, cc, periods: selectedPeriods, rows: movements });
});

// ─── /api/drilldown ──────────────────────────────────────────────────────────

router.get("/drilldown", (req, res) => {
  const schema = z.object({
    lineId: z.string().min(1),
    year:   z.string().regex(/^\d{4}$/).default("2025"),
    level1: z.string().optional(),
    periods: z.string().optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "lineId is required" }); return; }

  const { lineId, year, level1, periods } = parsed.data;
  if (drillByLine[lineId]) {
    res.json({ rows: drillByLine[lineId] });
    return;
  }

  const source = filterRowsByPeriods(
    filterRowsByLevel1(loadSourceRowsByYear(year), parseLevel1Param(level1)),
    parsePeriodsParam(periods)
  );
  const availablePeriods = [...new Set(source.map((r) => r.period))].filter(Boolean).sort();
  const current = availablePeriods[availablePeriods.length - 1] ?? "";
  const predicate = pnlLinePredicates[lineId];
  if (!predicate) { res.json({ rows: [] }); return; }

  const rows = source
    .filter((r) => r.period === current && predicate(r))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 30)
    .map<DrillRow>((r, idx) => ({
      id: `${lineId}-${idx}`,
      date: r.period,
      document: "P&L",
      account: r.account,
      costCenter: r.costCenter,
      detail: r.level3,
      amount: r.amount,
      adjustedAmount: r.amount,
    }));
  res.json({ rows });
});

// ─── /api/matrix ─────────────────────────────────────────────────────────────

const labelForAxis = (row: SourcePnlRow, axis: MatrixAxis) => {
  if (axis === "concept")     return row.account;
  if (axis === "cost_center") return row.costCenter;
  return row.period;
};

router.get("/matrix", (req, res) => {
  const schema = z.object({
    rowAxis: z.enum(["concept", "cost_center", "period"]).default("concept"),
    colAxis: z.enum(["concept", "cost_center", "period"]).default("period"),
    section: z.enum(["all", "habitual", "especiales"]).default("all"),
    year:    z.string().regex(/^\d{4}$/).default("2025"),
    level1:  z.string().optional(),
    periods: z.string().optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { rowAxis, colAxis, section, year, level1, periods } = parsed.data;
  if (rowAxis === colAxis) {
    res.status(400).json({ error: "rowAxis and colAxis must be different" });
    return;
  }

  const source = filterRowsByPeriods(
    filterRowsByLevel1(loadSourceRowsByYear(year), parseLevel1Param(level1)),
    parsePeriodsParam(periods)
  );
  const filtered = source.filter((r) => {
    const isEspeciales = lower(r.costCenter) === "servicios especiales";
    if (section === "especiales") return isEspeciales;
    if (section === "habitual")   return !isEspeciales;
    return true;
  });

  const rowHeaders = [...new Set(filtered.map((r) => labelForAxis(r, rowAxis)))].sort();
  const colHeaders = [...new Set(filtered.map((r) => labelForAxis(r, colAxis)))].sort();

  const bucket = new Map<string, number>();
  for (const r of filtered) {
    const key = `${labelForAxis(r, rowAxis)}__${labelForAxis(r, colAxis)}`;
    bucket.set(key, (bucket.get(key) ?? 0) + r.amount);
  }

  const rows = rowHeaders.map((rh) => {
    const values = colHeaders.map((ch) => bucket.get(`${rh}__${ch}`) ?? 0);
    return { rowKey: rh, values, total: values.reduce((a, b) => a + b, 0) };
  });

  const colTotals  = colHeaders.map((_, i) => rows.reduce((acc, row) => acc + row.values[i], 0));
  const grandTotal = colTotals.reduce((a, b) => a + b, 0);

  res.json({
    meta: { rowAxis, colAxis, section, source: path.basename(pnlExcelPath), rows: filtered.length },
    colHeaders,
    rows,
    colTotals,
    grandTotal,
  });
});

export default router;
