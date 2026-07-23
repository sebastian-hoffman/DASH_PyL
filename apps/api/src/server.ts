import app from "./app.js";
import { port } from "./config/index.js";

app.listen(port, () => {
  console.log(`DASH PL API running on http://localhost:${port}`);
});
