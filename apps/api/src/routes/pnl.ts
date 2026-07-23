import { Router } from "express";
import { z } from "zod";
import {
  buildBusinessBreakdown,
  buildPnlBuMatrix,
  buildUnitCostCenterBreakdown,
  buildUnitPnlCcMatrix,
} from "../lib/breakdown.js";
import { buildStructuredPnl, buildUnitPnl } from "../lib/pnl.js";
import { loadSourceRowsByYear } from "../data/loader.js";
import {
  filterRowsByLevel1,
  filterRowsByPeriods,
  parseLevel1Param,
  parsePeriodsParam,
} from "../lib/queryFilters.js";

const router = Router();
const yearSchema = z.object({
  year: z.string().regex(/^\d{4}$/).default("2025"),
  level1: z.string().optional(),
  periods: z.string().optional(),
});

router.get("/pnl", (req, res) => {
  const { year, level1, periods } = yearSchema.parse(req.query);
  const rows = filterRowsByPeriods(
    filterRowsByLevel1(loadSourceRowsByYear(year), parseLevel1Param(level1)),
    parsePeriodsParam(periods)
  );
  res.json(buildStructuredPnl(rows));
});

router.get("/pnl-breakdown", (req, res) => {
  const schema = z.object({
    groupBy:  z.enum(["bu", "vertical", "area", "cc"]).default("bu"),
    section:  z.enum(["habitual", "especiales", "all"]).default("habitual"),
    year:     z.string().regex(/^\d{4}$/).default("2025"),
    level1:   z.string().optional(),
    periods:  z.string().optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { groupBy, section, year, level1, periods } = parsed.data;
  const rows = filterRowsByPeriods(
    filterRowsByLevel1(loadSourceRowsByYear(year), parseLevel1Param(level1)),
    parsePeriodsParam(periods)
  );
  res.json(buildBusinessBreakdown(groupBy, section, rows));
});

router.get("/pnl-unit", (req, res) => {
  const schema = z.object({
    groupBy: z.enum(["bu", "vertical", "area", "cc"]).default("bu"),
    group:   z.string().min(1),
    section: z.enum(["habitual", "especiales", "all"]).default("habitual"),
    year:    z.string().regex(/^\d{4}$/).default("2025"),
    level1:  z.string().optional(),
    periods: z.string().optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { groupBy, group, section, year, level1, periods } = parsed.data;
  const rows = filterRowsByPeriods(
    filterRowsByLevel1(loadSourceRowsByYear(year), parseLevel1Param(level1)),
    parsePeriodsParam(periods)
  );
  res.json(buildUnitPnl(groupBy, group, section, rows));
});

router.get("/pnl-unit-cc-breakdown", (req, res) => {
  const schema = z.object({
    groupBy: z.enum(["bu", "vertical", "area", "cc"]).default("bu"),
    group:   z.string().min(1),
    section: z.enum(["habitual", "especiales", "all"]).default("habitual"),
    year:    z.string().regex(/^\d{4}$/).default("2025"),
    level1:  z.string().optional(),
    periods: z.string().optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { groupBy, group, section, year, level1, periods } = parsed.data;
  const rows = filterRowsByPeriods(
    filterRowsByLevel1(loadSourceRowsByYear(year), parseLevel1Param(level1)),
    parsePeriodsParam(periods)
  );
  res.json(buildUnitCostCenterBreakdown(groupBy, group, section, rows));
});

router.get("/pnl-unit-cc-matrix", (req, res) => {
  const schema = z.object({
    groupBy: z.enum(["bu", "vertical", "area", "cc"]).default("bu"),
    group:   z.string().min(1),
    section: z.enum(["habitual", "especiales", "all"]).default("habitual"),
    scope:   z.enum(["month", "quarter", "ytd"]).default("ytd"),
    year:    z.string().regex(/^\d{4}$/).default("2025"),
    level1:  z.string().optional(),
    periods: z.string().optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { groupBy, group, section, scope, year, level1, periods } = parsed.data;
  const rows = filterRowsByPeriods(
    filterRowsByLevel1(loadSourceRowsByYear(year), parseLevel1Param(level1)),
    parsePeriodsParam(periods)
  );
  res.json(buildUnitPnlCcMatrix(groupBy, group, section, scope, rows));
});

router.get("/pnl-bu-matrix", (req, res) => {
  const schema = z.object({
    scope:   z.enum(["month", "quarter", "ytd"]).default("ytd"),
    section: z.enum(["habitual", "especiales", "all"]).default("habitual"),
    year:    z.string().regex(/^\d{4}$/).default("2025"),
    level1:  z.string().optional(),
    periods: z.string().optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { scope, section, year, level1, periods } = parsed.data;
  const rows = filterRowsByPeriods(
    filterRowsByLevel1(loadSourceRowsByYear(year), parseLevel1Param(level1)),
    parsePeriodsParam(periods)
  );
  res.json(buildPnlBuMatrix(scope, section, rows));
});

export default router;
