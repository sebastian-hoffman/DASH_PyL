import { Router } from "express";
import { z } from "zod";
import { loadSourceRowsByYear } from "../data/loader.js";
import { buildExecutiveOverview } from "../lib/executive.js";
import {
  filterRowsByCostCenter,
  filterRowsByLevel1,
  filterRowsByPeriods,
  parseCostCenterParam,
  parseLevel1Param,
  parsePeriodsParam,
} from "../lib/queryFilters.js";

const router = Router();

router.get("/executive-overview", (req, res) => {
  const schema = z.object({
    year:    z.string().regex(/^\d{4}$/).default("2025"),
    level1:  z.string().optional(),
    periods: z.string().optional(),
    cc:      z.string().optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { year, level1, periods, cc } = parsed.data;
  const selectedLevel1 = parseLevel1Param(level1);
  const includeSpecials = selectedLevel1.some((l) => l.toLowerCase() === "z_especiales");
  const rows = filterRowsByCostCenter(
    filterRowsByPeriods(
      filterRowsByLevel1(loadSourceRowsByYear(year), selectedLevel1),
      parsePeriodsParam(periods)
    ),
    parseCostCenterParam(cc)
  );
  res.json(buildExecutiveOverview(rows, includeSpecials));
});

export default router;
