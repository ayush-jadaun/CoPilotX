import MessageBus from "../utills/MemoryBus.js";

/**
 * Handle a CTO agent task request via MessageBus.
 * Expects: { task: string }
 */
export async function handleCTOAgentTask(req, res) {
  const { task } = req.body;
  if (!task) return res.status(400).json({ error: "No task provided" });

  const replyChannel = `api.cto.response.${Date.now()}.${Math.random()
    .toString(36)
    .slice(2)}`;
  let responded = false;
  const bus = new MessageBus("api-cto");

  const handler = (msg) => {
    if (!responded) {
      responded = true;
      res.json(msg);
      bus.unsubscribe(replyChannel, handler);
    }
  };

  await bus.subscribe(replyChannel, handler);

  await bus.publish("agent.cto.task", "CTO_TASK", {
    userTask: task,
    replyChannel,
  });

  setTimeout(() => {
    if (!responded) {
      responded = true;
      res.status(504).json({ error: "CTO agent timeout" });
      bus.unsubscribe(replyChannel, handler);
    }
  }, 60000);
}
