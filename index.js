import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { handleCMOAgentTask } from "./controllers/cmoAgentController.js";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// ROUTES
app.post("/agent/cmo", handleCMOAgentTask);

app.get("/test", (req, res) => {
  res.json({ message: "Server is running" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CMO Agent Server running on port ${PORT}`);
});
