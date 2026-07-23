import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "node:url";
import adjustmentsRouter from "./routes/adjustments.js";
import commentsRouter    from "./routes/comments.js";
import drilldownRouter   from "./routes/drilldown.js";
import executiveRouter   from "./routes/executive.js";
import explorerRouter    from "./routes/explorer.js";
import filesRouter       from "./routes/files.js";
import healthRouter      from "./routes/health.js";
import importRouter      from "./routes/import.js";
import overviewRouter    from "./routes/overview.js";
import periodsRouter     from "./routes/periods.js";
import pnlRouter         from "./routes/pnl.js";
import { loadJournalAdjustments } from "./store/adjustments.js";

// Boot-time side effects
loadJournalAdjustments();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from web build (for production on Railway)
const webDistPath = path.resolve(__dirname, "../../web/dist");
app.use(express.static(webDistPath));

// Mount all routers under /api
app.use("/api", healthRouter);
app.use("/api", overviewRouter);
app.use("/api", executiveRouter);
app.use("/api", pnlRouter);
app.use("/api", periodsRouter);
app.use("/api", adjustmentsRouter);
app.use("/api", explorerRouter);
app.use("/api", drilldownRouter);
app.use("/api", filesRouter);
app.use("/api", importRouter);
app.use("/api", commentsRouter);

// SPA fallback: serve index.html for any non-API route not matched above
app.use((req, res) => {
  res.sendFile(path.join(webDistPath, "index.html"));
});

export default app;
