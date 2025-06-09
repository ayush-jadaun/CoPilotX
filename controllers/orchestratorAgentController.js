import { orchestrateWithPlanning } from "../agents/orchestratorAgent.js";
/**
 * HTTP handler to process user idea via orchestrator agent.
 * POST /api/orchestrate { task: string }
 */
export async function handleOrchestratorRequest(req, res) {
  const { task } = req.body;
  if (!task) return res.status(400).json({ error: "No task provided" });

  try {
    const results = await orchestrateWithPlanning(task, `session-${Date.now()}`);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}
