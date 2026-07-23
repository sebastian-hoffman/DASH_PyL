import fs from "node:fs";
import { dataDir, journalAdjustmentsPath } from "../config/index.js";
import type { Adjustment, JournalAdjustment } from "../types/index.js";

export const adjustments: Adjustment[] = [];
export const journalAdjustments: JournalAdjustment[] = [];

export const loadJournalAdjustments = (): void => {
  try {
    if (!fs.existsSync(journalAdjustmentsPath)) return;
    const raw = fs.readFileSync(journalAdjustmentsPath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      journalAdjustments.push(...(parsed as JournalAdjustment[]));
    }
  } catch (error) {
    console.error("Could not load journal adjustments:", error);
  }
};

export const persistJournalAdjustments = (): void => {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(journalAdjustmentsPath, JSON.stringify(journalAdjustments, null, 2), "utf-8");
  } catch (error) {
    console.error("Could not persist journal adjustments:", error);
  }
};
