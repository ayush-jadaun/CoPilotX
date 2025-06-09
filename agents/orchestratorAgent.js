import MessageBus from "../utills/MemoryBus.js";
/**
 * Orchestrator agent: coordinates all department agents for a startup idea.
 * @param {string} userTask - The user's startup idea or request.
 * @param {string} sessionId - Session identifier to keep context (optional).
 * @param {number} timeoutMs - Max time to wait for each agent (default: 30s).
 * @returns {Promise<object>} Aggregated results from all agents.
 */
export async function orchestrateStartupIdea(
  userTask,
  sessionId = "default",
  timeoutMs = 30000
) {
  const bus = new MessageBus("orchestrator");
  const agents = [
    { name: "ceo", taskType: "CEO_TASK" },
    { name: "cto", taskType: "CTO_TASK" },
    { name: "cmo", taskType: "CMO_TASK" },
    { name: "cfo", taskType: "CFO_TASK" },
  ];

  const results = {};

  // Helper to request each agent and wait for response
  async function callAgent(agentName, taskType, input) {
    const replyChannel = `orchestrator.${agentName}.reply.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2)}`;

    // Wait for agent's response (with timeout)
    const p = new Promise(async (resolve, reject) => {
      const handler = (msg) => {
        bus.unsubscribe(replyChannel, handler);
        resolve(msg);
      };
      await bus.subscribe(replyChannel, handler);
      setTimeout(() => {
        bus.unsubscribe(replyChannel, handler);
        reject(new Error(`${agentName} response timeout`));
      }, timeoutMs);
    });

    // Publish task
    await bus.publish(`agent.${agentName}.task`, taskType, {
      userTask: input,
      sessionId,
      replyChannel,
    });

    return p;
  }

  // Call all agents in parallel
  const agentPromises = agents.map(({ name, taskType }) =>
    callAgent(name, taskType, userTask)
      .then((result) => (results[name] = result))
      .catch((err) => (results[name] = { error: err.message }))
  );

  await Promise.all(agentPromises);

  return results;
}
