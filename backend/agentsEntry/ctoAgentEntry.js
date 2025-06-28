import { subscribeToCTOTasks,runCTOAgent } from "../agents/ctoAgent.js";
console.log("[CTOAgentEntry] Starting CTO Agent...");
subscribeToCTOTasks(runCTOAgent);
