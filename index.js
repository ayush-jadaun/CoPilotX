import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { handleCMOAgentTask } from "./controllers/cmoAgentController.js";
import { handleCTOAgentTask } from "./controllers/ctoAgentController.js";
import { handleCFOAgentTask } from "./controllers/cfoAgentController.js";
import { handleCEOAgentTask } from "./controllers/ceoAgentController.js";
import vectorMemoryRoutes from "./routes/vectorMemoryRoutes.js"
import { handleOrchestratorRequest } from "./controllers/orchestratorAgentController.js";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// ROUTES
app.post("/agent/cmo", handleCMOAgentTask);
app.post("/agent/cto", handleCTOAgentTask);
app.post("/agent/cfo", handleCFOAgentTask);
app.post("/agent/ceo", handleCEOAgentTask);
app.use("/vector-memory", vectorMemoryRoutes);
app.use("/agent/orchestrator",handleOrchestratorRequest)

app.get("/test", (req, res) => {
  res.json({ message: "Server is running" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Agent Server running on port ${PORT}`);
});
