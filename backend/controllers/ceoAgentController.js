import MessageBus from "../utills/MemoryBus.js";

/**
 * Handle a CEO agent task request via MessageBus.
 * Expects: { task: string }
 */
export async function handleCEOAgentTask(req, res) {
  const { task } = req.body;
  if (!task) return res.status(400).json({ error: "No task provided" });

  const replyChannel = `api.ceo.response.${Date.now()}.${Math.random()
    .toString(36)
    .slice(2)}`;
  let responded = false;
  const bus = new MessageBus("api-ceo");

  const handler = (msg) => {
    if (!responded) {
      responded = true;
      res.json(msg);
      bus.unsubscribe(replyChannel, handler);
    }
  };

  await bus.subscribe(replyChannel, handler);

  await bus.publish("agent.ceo.task", "CEO_TASK", {
    userTask: task,
    replyChannel,
  });

  setTimeout(() => {
    if (!responded) {
      responded = true;
      res.status(504).json({ error: "CEO agent timeout" });
      bus.unsubscribe(replyChannel, handler);
    }
  }, 60000);
}
