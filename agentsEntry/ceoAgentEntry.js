import { subscribeToCEOTasks, runCEOAgent } from "../agents/ceoAgent.js";
console.log("[CEOAgentEntry] Starting CEO Agent...");
subscribeToCEOTasks(runCEOAgent);
