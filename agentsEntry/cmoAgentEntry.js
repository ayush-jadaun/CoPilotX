import { subscribeToCMOTasks,runCMOAgent } from "../agents/cmoAgent.js";
console.log("[CMOAgentEntry] Starting CMO Agent...");
subscribeToCMOTasks(runCMOAgent);
