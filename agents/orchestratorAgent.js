import MessageBus from "../utills/MemoryBus.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// Use Gemini ONLY for task planning/decomposition
const llm = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "models/gemini-2.0-flash",
  temperature: 0,
});

// 1. Use Gemini to decompose the user prompt into agent-specific subtasks
async function planWithGemini(userTask) {
  const systemPrompt = `
You are a startup orchestrator. 
Given a user request, decompose it into actionable subtasks for these agents:
- CEO: Vision, GTM, positioning, market, mission
- CTO: Tech, architecture, MVP, APIs, integration, stack
- CMO: Marketing, landing page, SEO, copy, content
- CFO: Pricing, runway, finance, model, funding, cost

Return one subtask for each agent in this JSON format:
[
  {"agent": "ceo", "subtask": "..."},
  {"agent": "cto", "subtask": "..."},
  {"agent": "cmo", "subtask": "..."},
  {"agent": "cfo", "subtask": "..."}
]

User request: "${userTask}"
`;

const response = await llm.invoke(systemPrompt);
  let subtasks = [];
  try {
    subtasks = JSON.parse(response.output || response);
  } catch (e) {
    // fallback default
    subtasks = [
      {
        agent: "ceo",
        subtask: "Refine the vision and value proposition for this idea.",
      },
      {
        agent: "cto",
        subtask: "Propose an MVP architecture and appropriate tech stack.",
      },
      {
        agent: "cmo",
        subtask: "Draft marketing copy and a basic landing page outline.",
      },
      {
        agent: "cfo",
        subtask: "Create a basic pricing model and 12-month financial plan.",
      },
    ];
  }
  return subtasks;
}

// 2. Orchestrator: keep the old agent names/channels, just use Gemini for planning
export async function orchestrateWithPlanning(
  userTask,
  sessionId = "default",
  timeoutMs = 30000
) {
  const bus = new MessageBus("orchestrator");
  const results = {};

  // Step 1: Use Gemini to produce agent-specific subtasks
  const subtasks = await planWithGemini(userTask);

  // Step 2: Dispatch each subtask to its assigned agent
  const agentPromises = subtasks.map(({ agent, subtask }) => {
    const replyChannel = `orchestrator.${agent}.reply.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2)}`;

    const p = new Promise(async (resolve, reject) => {
      const handler = (msg) => {
        bus.unsubscribe(replyChannel, handler);
        resolve(msg);
      };
      await bus.subscribe(replyChannel, handler);
      setTimeout(() => {
        bus.unsubscribe(replyChannel, handler);
        reject(new Error(`${agent} response timeout`));
      }, timeoutMs);
    });

    // Publish the subtask to the agent
    bus.publish(`agent.${agent}.task`, `${agent.toUpperCase()}_TASK`, {
      userTask: subtask,
      sessionId,
      replyChannel,
    });

    return p
      .then((result) => (results[agent] = result))
      .catch((err) => (results[agent] = { error: err.message }));
  });

  await Promise.all(agentPromises);

  return results;
}
