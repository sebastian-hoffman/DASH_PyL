import { Router } from "express";
import { z } from "zod";
import { loadSourceRows } from "../data/loader.js";
import {
  adjustments,
  journalAdjustments,
  persistJournalAdjustments,
} from "../store/adjustments.js";
import type { Adjustment, JournalAdjustment } from "../types/index.js";

const router = Router();

const PATRIMONIAL_ACCOUNTS = ["Patrimonial Ajustes", "Resultados Acumulados", "Cuenta Patrimonial"];

router.get("/adjustment-options", (_req, res) => {
  const rows      = loadSourceRows();
  const accounts  = [...new Set(rows.map((r) => r.account).filter(Boolean))].sort();
  const costCenters = [...new Set(rows.map((r) => r.costCenter).filter(Boolean))].sort();
  const periods   = [...new Set(rows.map((r) => r.period).filter(Boolean))].sort();
  res.json({
    accounts:    [...new Set([...accounts, ...PATRIMONIAL_ACCOUNTS])],
    costCenters,
    periods,
  });
});

router.get("/adjustments", (_req, res) => {
  res.json({ adjustments: journalAdjustments, rows: adjustments, journalRows: journalAdjustments });
});

const legacySchema = z.object({
  lineId:         z.string(),
  adjustmentType: z.enum(["reclass", "fixed_amount"]),
  amount:         z.number().default(0),
  target:         z.enum(["all", "month", "quarter", "ytd"]).default("all"),
  note:           z.string().min(3),
});

const journalSchema = z.object({
  kind:   z.enum(["reclassification", "result_impact"]),
  amount: z.number().positive(),
  debit:  z.object({
    account:    z.string().min(1),
    costCenter: z.string().min(1),
    period:     z.string().regex(/^\d{4}-\d{2}$/),
  }),
  credit: z.object({
    account:    z.string().min(1),
    costCenter: z.string().min(1),
    period:     z.string().regex(/^\d{4}-\d{2}$/),
  }),
  note:             z.string().min(3),
  referenceLineId:  z.string().optional(),
});

const adjustmentIdParams = z.object({
  id: z.string().min(1),
});

router.post("/adjustments", (req, res) => {
  const legacyParsed = legacySchema.safeParse(req.body);
  if (legacyParsed.success) {
    const adj: Adjustment = {
      id:             `adj-${Date.now()}`,
      lineId:         legacyParsed.data.lineId,
      adjustmentType: legacyParsed.data.adjustmentType,
      amount:         legacyParsed.data.amount,
      target:         legacyParsed.data.target,
      note:           legacyParsed.data.note,
      createdAt:      new Date().toISOString(),
    };
    adjustments.push(adj);
    res.status(201).json({ saved: true, data: adj });
    return;
  }

  const journalParsed = journalSchema.safeParse(req.body);
  if (!journalParsed.success) {
    res.status(400).json({ error: journalParsed.error.flatten() });
    return;
  }

  const adj: JournalAdjustment = {
    id:              `jadj-${Date.now()}`,
    kind:            journalParsed.data.kind,
    amount:          journalParsed.data.amount,
    debit:           journalParsed.data.debit,
    credit:          journalParsed.data.credit,
    note:            journalParsed.data.note,
    referenceLineId: journalParsed.data.referenceLineId,
    createdAt:       new Date().toISOString(),
  };
  journalAdjustments.push(adj);
  persistJournalAdjustments();
  res.status(201).json({ saved: true, data: adj, mode: "journal" });
});

router.put("/adjustments/:id", (req, res) => {
  const parsedParams = adjustmentIdParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.flatten() });
    return;
  }

  const parsedBody = journalSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.flatten() });
    return;
  }

  const index = journalAdjustments.findIndex((adjustment) => adjustment.id === parsedParams.data.id);
  if (index === -1) {
    res.status(404).json({ error: "Adjustment not found" });
    return;
  }

  const existing = journalAdjustments[index];
  const updated: JournalAdjustment = {
    ...existing,
    kind: parsedBody.data.kind,
    amount: parsedBody.data.amount,
    debit: parsedBody.data.debit,
    credit: parsedBody.data.credit,
    note: parsedBody.data.note,
    referenceLineId: parsedBody.data.referenceLineId,
  };

  journalAdjustments[index] = updated;
  persistJournalAdjustments();
  res.json({ saved: true, data: updated, mode: "journal" });
});

router.delete("/adjustments/:id", (req, res) => {
  const parsedParams = adjustmentIdParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.flatten() });
    return;
  }

  const index = journalAdjustments.findIndex((adjustment) => adjustment.id === parsedParams.data.id);
  if (index === -1) {
    res.status(404).json({ error: "Adjustment not found" });
    return;
  }

  const [deleted] = journalAdjustments.splice(index, 1);
  persistJournalAdjustments();
  res.json({ deleted: true, data: deleted });
});

export default router;
