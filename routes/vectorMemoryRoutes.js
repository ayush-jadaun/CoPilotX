import express from "express";
import MemoryManager from "../agents/memory/MemoryManager.js";

const router = express.Router();

/**
 * MemoryManager cache for each agent type.
 * Ensures only one MemoryManager per agent per process.
 */
const managers = {};

function getManager(agentType) {
  if (!managers[agentType]) {
    managers[agentType] = new MemoryManager(agentType);
    // Initialize manager async, but don't block route handler
    managers[agentType]
      .initialize()
      .catch((err) =>
        console.error(`[VectorMemory][${agentType}] Init failed:`, err)
      );
  }
  return managers[agentType];
}

/**
 * Store an interaction for an agent (vector + session memory).
 * POST /vector-memory/:agent/store
 * Body: { userTask, result, sessionId?, metadata? }
 */
router.post("/:agent/store", async (req, res) => {
  const { agent } = req.params;
  const { userTask, result, sessionId = "default", metadata = {} } = req.body;
  if (!userTask || !result) {
    return res.status(400).json({ error: "Missing userTask or result" });
  }
  try {
    const manager = getManager(agent);
    await manager.storeInteraction(userTask, result, sessionId, metadata);
    res.json({ success: true, agent, sessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Retrieve relevant context for an agent.
 * POST /vector-memory/:agent/query
 * Body: { query, sessionId?, options? }
 */
router.post("/:agent/query", async (req, res) => {
  const { agent } = req.params;
  const { query, sessionId = "default", options = {} } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }
  try {
    const manager = getManager(agent);
    const context = await manager.getRelevantContext(query, sessionId, options);
    res.json({ agent, sessionId, context });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Clear all memory for an agent (session + vector memory).
 * POST /vector-memory/:agent/clear
 */
router.post("/:agent/clear", async (req, res) => {
  const { agent } = req.params;
  try {
    const manager = getManager(agent);
    await manager.clearAllMemory();
    res.json({ success: true, agent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get memory stats for an agent.
 * GET /vector-memory/:agent/status
 */
router.get("/:agent/status", async (req, res) => {
  const { agent } = req.params;
  try {
    const manager = getManager(agent);
    const status = await manager.getMemoryStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
