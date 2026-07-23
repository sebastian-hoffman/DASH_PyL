import { Router } from "express";
import { z } from "zod";
import { loadAllSourceRows, loadSourceRowsByYear } from "../data/loader.js";
import { filterRowsByLevel1, parseLevel1Param } from "../lib/queryFilters.js";

const router = Router();

router.get("/periods", (req, res) => {
  const { year, level1 } = z.object({
    year: z.string().regex(/^\d{4}$/).optional(),
    level1: z.string().optional(),
  }).parse(req.query);
  const sourceRows = year ? loadSourceRowsByYear(year) : loadAllSourceRows();
  const selectedLevel1 = parseLevel1Param(level1);
  const rows = filterRowsByLevel1(sourceRows, selectedLevel1);
  const periodsSet = new Map<string, string>();
  for (const r of rows) {
    if (r.period) periodsSet.set(r.period, r.quarter ?? "");
  }
  const level1Dimensions = [...new Set(sourceRows.map((r) => r.ccLevel1 || "Sin BU"))].sort();
  const costCenters = [...new Set(rows.map((r) => r.costCenter).filter(Boolean))].sort();
  const sorted = [...periodsSet.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, quarter]) => ({ period, quarter }));
  res.json({ periods: sorted, level1Dimensions, costCenters });
});

export default router;
