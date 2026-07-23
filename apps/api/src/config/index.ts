import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, "../../../..");
export const pnlExcelPath     = path.join(projectRoot, "Perdidas y ganancias.xlsx");
export const pyg2026ExcelPath = path.join(projectRoot, "PyG_2026_06.xlsx");
export const dataDir = path.join(projectRoot, "apps", "api", "data");
export const journalAdjustmentsPath = path.join(dataDir, "journal-adjustments.json");
export const port = Number(process.env.PORT ?? 4000);
