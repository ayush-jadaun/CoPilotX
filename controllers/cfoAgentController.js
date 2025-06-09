import MessageBus from "../utills/MemoryBus.js";

/**
 * Handle a CFO agent task request via MessageBus.
 * Expects: { task: string }
 */
export async function handleCFOAgentTask(req, res) {
  const { task } = req.body;
  if (!task) return res.status(400).json({ error: "No task provided" });

  const replyChannel = `api.cfo.response.${Date.now()}.${Math.random()
    .toString(36)
    .slice(2)}`;
  let responded = false;
  const bus = new MessageBus("api-cfo");

  const handler = (msg) => {
    if (!responded) {
      responded = true;
      res.json(msg);
      bus.unsubscribe(replyChannel, handler);
    }
  };

  await bus.subscribe(replyChannel, handler);

  await bus.publish("agent.cfo.task", "CFO_TASK", {
    userTask: task,
    replyChannel,
  });

  setTimeout(() => {
    if (!responded) {
      responded = true;
      res.status(504).json({ error: "CFO agent timeout" });
      bus.unsubscribe(replyChannel, handler);
    }
  }, 60000);
}
