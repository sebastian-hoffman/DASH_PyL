import { Router } from "express";
import { z } from "zod";
import { loadSourceRowsByYear } from "../data/loader.js";
import {
  filterRowsByLevel1,
  filterRowsByPeriods,
  parseLevel1Param,
  parsePeriodsParam,
} from "../lib/queryFilters.js";

const router = Router();

router.get("/cc-explorer", (req, res) => {
  const schema = z.object({
    cc:      z.string().min(1),
    periods: z.string().optional(),
    year:    z.string().regex(/^\d{4}$/).default("2025"),
    level1:  z.string().optional(),
    filterPeriods: z.string().optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { cc, periods: periodsParam, year, level1, filterPeriods } = parsed.data;
  const allRows = filterRowsByPeriods(
    filterRowsByLevel1(loadSourceRowsByYear(year), parseLevel1Param(level1)),
    parsePeriodsParam(filterPeriods)
  );
  const allPeriods   = [...new Set(allRows.map((r) => r.period))].filter(Boolean).sort();
  const selectedPeriods = periodsParam
    ? periodsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : allPeriods;

  const ccRows = allRows.filter((r) => r.costCenter === cc && selectedPeriods.includes(r.period));

  const byAccount = new Map<string, { level2: string; level3: string; total: number }>();
  for (const r of ccRows) {
    const key      = r.account || "(sin cuenta)";
    const existing = byAccount.get(key);
    if (existing) {
      existing.total += r.amount;
    } else {
      byAccount.set(key, { level2: r.level2 ?? "", level3: r.level3 ?? "", total: r.amount });
    }
  }

  const rows = [...byAccount.entries()]
    .map(([account, v]) => ({ account, level2: v.level2, level3: v.level3, total: v.total }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  const availableCCs = [...new Set(
    allRows.filter((r) => selectedPeriods.includes(r.period)).map((r) => r.costCenter).filter(Boolean)
  )].sort();

  res.json({ cc, periods: selectedPeriods, grandTotal, rows, availableCCs });
});

export default router;
