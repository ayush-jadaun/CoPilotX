import { createReactAgent, AgentExecutor } from "langchain/agents";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { cmoAgentPrompt } from "../prompts/cmoAgentPromt.js";
import MessageBus from "../utills/MemoryBus.js";

// Initialize the message bus for CMO Agent
const bus = new MessageBus("cmo");

// Use a supported model for Google AI Studio API key
const llm = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "models/gemini-2.0-flash",
  temperature: 0,
});

// No extra tools for CMO agent
const tools = [];

const agent = await createReactAgent({
  llm,
  tools,
  prompt: cmoAgentPrompt,
});

export const cmoAgentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: true,
  maxIterations: 20,
  returnIntermediateSteps: true,
  handleParsingErrors: true,
});

// Always treat the task as simple: just run it through the agent
export async function runCMOAgent(userTask, pubSubOptions = {}) {
  try {
    console.log("Starting CMO agent with task:", userTask);

    console.log("Using CMO agent for all tasks...");
    const agentResult = await cmoAgentExecutor.invoke({
      input: userTask,
    });
    const result = agentResult.output ?? agentResult;
    const mode = "simple";

    if (pubSubOptions.publishResult) {
      await bus.publish(
        pubSubOptions.publishChannel || "agent.cmo",
        "CMO_RESULT",
        {
          userTask,
          mode,
          result,
          contextUsed: [],
        }
      );
    }

    return { mode, result };
  } catch (error) {
    console.error("CMO agent execution failed:", error);
    if (pubSubOptions.publishResult) {
      await bus.publish(
        pubSubOptions.publishChannel || "agent.cmo",
        "CMO_ERROR",
        {
          userTask,
          error: error.message || error,
        }
      );
    }
    throw error;
  }
}

// Listen for CMO tasks via pubsub and auto-process
export function subscribeToCMOTasks(cmoAgentRunner = runCMOAgent) {
  bus.subscribe("agent.cmo.task", async (msg) => {
    try {
      console.log("[CMOAgent] Processing message:", msg);

      // Defensive: accept both old and new formats during transition
      const data = msg.data || msg;
      if (!data || !data.userTask) {
        console.error("[CMOAgent] Invalid message format:", msg);
        return;
      }

      const { userTask, replyChannel } = data;
      console.log("[CMOAgent] Received CMO task:", userTask);
      console.log("[CMOAgent] Reply channel:", replyChannel);

      if (!replyChannel) {
        console.error("[CMOAgent] No reply channel provided");
        return;
      }

      // Use passed runner (for testing/mocking)
      console.log("[CMOAgent] Running CMO agent...");
      const result = await cmoAgentRunner(userTask);

      console.log("[CMOAgent] CMO result:", result);
      console.log("[CMOAgent] Publishing result to channel:", replyChannel);

      await bus.publish(replyChannel, "CMO_RESULT", {
        output: result.result,
        mode: result.mode,
      });

      console.log("[CMOAgent] Successfully published result!");
    } catch (err) {
      console.error("[CMOAgent] Error in handler:", err);
      if (msg?.data?.replyChannel) {
        try {
          await bus.publish(msg.data.replyChannel, "CMO_ERROR", {
            error: err.message || "Unknown error occurred",
          });
        } catch (publishErr) {
          console.error("[CMOAgent] Failed to publish error:", publishErr);
        }
      }
    }
  });
}
