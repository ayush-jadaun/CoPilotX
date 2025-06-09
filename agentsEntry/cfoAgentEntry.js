import { subscribeToCFOTasks, runCFOAgent } from "../agents/cfoAgent.js";
console.log("[CFOAgentEntry] Starting CFO Agent...");
subscribeToCFOTasks(runCFOAgent);
