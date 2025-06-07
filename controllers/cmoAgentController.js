import MessageBus from "../utills/MemoryBus.js";

/**
 * Handle a CMO agent task request via MessageBus.
 * Expects: { task: string }
 */
export async function handleCMOAgentTask(req, res) {
  const { task } = req.body;
  if (!task) return res.status(400).json({ error: "No task provided" });

  const replyChannel = `api.cmo.response.${Date.now()}.${Math.random()
    .toString(36)
    .slice(2)}`;
  let responded = false;
  const bus = new MessageBus("api-cmo");

  // Use a named handler reference
  const handler = (msg) => {
    if (!responded) {
      responded = true;
      res.json(msg);
      bus.unsubscribe(replyChannel, handler);
    }
  };

  await bus.subscribe(replyChannel, handler);

  await bus.publish("agent.cmo.task", "CMO_TASK", {
    userTask: task,
    replyChannel,
  });

  setTimeout(() => {
    if (!responded) {
      responded = true;
      res.status(504).json({ error: "CMO agent timeout" });
      bus.unsubscribe(replyChannel, handler);
    }
  }, 60000);
}
