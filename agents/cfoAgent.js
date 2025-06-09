import { createReactAgent, AgentExecutor } from "langchain/agents";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {cfoAgentPrompt} from "../prompts/cfoAgentPromt.js"
import MessageBus from "../utills/MemoryBus.js";
import MemoryManager from "./memory/MemoryManager.js";

const bus = new MessageBus("cfo");

let memoryManager = null;
try {
  memoryManager = new MemoryManager("cfo");
  await memoryManager.initialize();
  console.log("[CFOAgent] Memory system initialized");
} catch (error) {
  console.warn(
    "[CFOAgent] Memory system failed to initialize, running without memory:",
    error.message
  );
  memoryManager = null;
}

const llm = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "models/gemini-2.0-flash",
  temperature: 0,
});

const tools = [];

const agent = await createReactAgent({
  llm,
  tools,
  prompt: cfoAgentPrompt,
});

export const cfoAgentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: true,
  maxIterations: 20,
  returnIntermediateSteps: true,
  handleParsingErrors: true,
});

export async function runCFOAgent(userTask, pubSubOptions = {}) {
  try {
    console.log("Starting CFO agent with task:", userTask);

    const sessionId = pubSubOptions.sessionId || "default";
    let contextItems = [];
    let enhancedInput = userTask;
    let mode = "simple";

    if (memoryManager) {
      try {
        contextItems = await memoryManager.getRelevantContext(
          userTask,
          sessionId,
          {
            vectorTopK: 3,
            sessionLimit: 3,
          }
        );

        if (contextItems.length > 0) {
          const contextString =
            memoryManager.formatContextForPrompt(contextItems);
          enhancedInput = contextString
            ? `${contextString}Current Task: ${userTask}`
            : userTask;
          mode = "contextual";
          console.log("Using context:", contextItems.length, "items");
        }
      } catch (error) {
        console.warn("[CFOAgent] Context retrieval failed:", error.message);
      }
    }

    console.log("Using CFO agent...");

    const agentResult = await cfoAgentExecutor.invoke({
      input: enhancedInput,
    });

    const result = agentResult.output ?? agentResult;

    if (memoryManager) {
      try {
        await memoryManager.storeInteraction(userTask, result, sessionId);
      } catch (error) {
        console.warn("[CFOAgent] Failed to store interaction:", error.message);
      }
    }

    if (pubSubOptions.publishResult) {
      await bus.publish(
        pubSubOptions.publishChannel || "agent.cfo",
        "CFO_RESULT",
        {
          userTask,
          mode,
          result,
          contextUsed: contextItems.map((item) => ({
            type: item.type,
            timestamp: item.metadata?.timestamp,
          })),
        }
      );
    }

    return { mode, result, contextUsed: contextItems.length };
  } catch (error) {
    console.error("CFO agent execution failed:", error);
    if (pubSubOptions.publishResult) {
      await bus.publish(
        pubSubOptions.publishChannel || "agent.cfo",
        "CFO_ERROR",
        {
          userTask,
          error: error.message || error,
        }
      );
    }
    throw error;
  }
}

export function subscribeToCFOTasks(cfoAgentRunner = runCFOAgent) {
  bus.subscribe("agent.cfo.task", async (msg) => {
    try {
      console.log("[CFOAgent] Processing message:", msg);
      const data = msg.data || msg;

      if (!data || !data.userTask) {
        console.error("[CFOAgent] Invalid message format:", msg);
        return;
      }

      const { userTask, replyChannel, sessionId } = data;
      console.log("[CFOAgent] Received CFO task:", userTask);
      console.log("[CFOAgent] Session ID:", sessionId);

      if (!replyChannel) {
        console.error("[CFOAgent] No reply channel provided");
        return;
      }

      const result = await cfoAgentRunner(userTask, { sessionId });
      console.log("[CFOAgent] CFO result:", result);

      await bus.publish(replyChannel, "CFO_RESULT", {
        output: result.result,
        mode: result.mode,
        contextUsed: result.contextUsed,
        sessionId,
      });

      console.log("[CFOAgent] Successfully published result!");
    } catch (err) {
      console.error("[CFOAgent] Error in handler:", err);
      if (msg?.data?.replyChannel) {
        try {
          await bus.publish(msg.data.replyChannel, "CFO_ERROR", {
            error: err.message || "Unknown error occurred",
            sessionId: msg.data.sessionId,
          });
        } catch (publishErr) {
          console.error("[CFOAgent] Failed to publish error:", publishErr);
        }
      }
    }
  });
}

export { memoryManager };
