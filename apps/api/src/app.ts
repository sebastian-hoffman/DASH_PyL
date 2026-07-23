import cors from "cors";
import express from "express";
import adjustmentsRouter from "./routes/adjustments.js";
import commentsRouter      from "./routes/comments.js";
import drilldownRouter   from "./routes/drilldown.js";
import executiveRouter   from "./routes/executive.js";
import explorerRouter    from "./routes/explorer.js";
import filesRouter       from "./routes/files.js";
import healthRouter      from "./routes/health.js";
import overviewRouter    from "./routes/overview.js";
import periodsRouter     from "./routes/periods.js";
import pnlRouter         from "./routes/pnl.js";
import { loadJournalAdjustments } from "./store/adjustments.js";

// Boot-time side effects
loadJournalAdjustments();

const app = express();
app.use(cors());
app.use(express.json());

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
app.use("/api", commentsRouter);

export default app;
