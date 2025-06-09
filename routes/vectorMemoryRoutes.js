import express from "express";
import MemoryManager from "../agents/memory/MemoryManager.js";

const router = express.Router();
const managers = {};

function getManager(agentType) {
  if (!managers[agentType]) {
    managers[agentType] = new MemoryManager(agentType);
    managers[agentType]
      .initialize()
      .catch((err) =>
        console.error(`[VectorMemory][${agentType}] Init failed:`, err)
      );
  }
  return managers[agentType];
}

// Store an interaction
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

// Retrieve context
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

// Clear all memory
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

// Get status
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
