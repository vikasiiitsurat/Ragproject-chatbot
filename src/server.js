import { app } from "./app.js";
import { config } from "./config.js";
app.listen(config.port, () => console.log(`Document RAG Workspace is running at http://localhost:${config.port}`));
