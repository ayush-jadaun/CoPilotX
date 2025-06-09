import { createReactAgent, AgentExecutor } from "langchain/agents";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ctoAgentPrompt } from "../prompts/ctoAgentPromt.js";
import MessageBus from "../utills/MemoryBus.js";
import MemoryManager from "./memory/MemoryManager.js";

const bus = new MessageBus("cto");

let memoryManager = null;
try {
  memoryManager = new MemoryManager("cto");
  await memoryManager.initialize();
  console.log("[CTOAgent] Memory system initialized");
} catch (error) {
  console.warn(
    "[CTOAgent] Memory system failed to initialize, running without memory:",
    error.message
  );
  memoryManager = null;
}

// Use a supported model for Google AI Studio API key
const llm = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "models/gemini-2.0-flash",
  temperature: 0,
});

// No extra tools for CTO agent at this stage
const tools = [];

const agent = await createReactAgent({
  llm,
  tools,
  prompt: ctoAgentPrompt,
});

export const ctoAgentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: true,
  maxIterations: 20,
  returnIntermediateSteps: true,
  handleParsingErrors: true,
});

export async function runCTOAgent(userTask, pubSubOptions = {}) {
  try {
    console.log("Starting CTO agent with task:", userTask);

    const sessionId = pubSubOptions.sessionId || "default";
    let contextItems = [];
    let enhancedInput = userTask;
    let mode = "simple";

    // Try to get context if memory system is available
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
        console.warn("[CTOAgent] Context retrieval failed:", error.message);
      }
    }

    console.log("Using CTO agent...");

    const agentResult = await ctoAgentExecutor.invoke({
      input: enhancedInput,
    });

    const result = agentResult.output ?? agentResult;

    // Store interaction if memory system is available
    if (memoryManager) {
      try {
        await memoryManager.storeInteraction(userTask, result, sessionId);
      } catch (error) {
        console.warn("[CTOAgent] Failed to store interaction:", error.message);
      }
    }

    if (pubSubOptions.publishResult) {
      await bus.publish(
        pubSubOptions.publishChannel || "agent.cto",
        "CTO_RESULT",
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
    console.error("CTO agent execution failed:", error);
    if (pubSubOptions.publishResult) {
      await bus.publish(
        pubSubOptions.publishChannel || "agent.cto",
        "CTO_ERROR",
        {
          userTask,
          error: error.message || error,
        }
      );
    }
    throw error;
  }
}

// Enhanced subscription handler with session support
export function subscribeToCTOTasks(ctoAgentRunner = runCTOAgent) {
  bus.subscribe("agent.cto.task", async (msg) => {
    try {
      console.log("[CTOAgent] Processing message:", msg);
      const data = msg.data || msg;

      if (!data || !data.userTask) {
        console.error("[CTOAgent] Invalid message format:", msg);
        return;
      }

      const { userTask, replyChannel, sessionId } = data;
      console.log("[CTOAgent] Received CTO task:", userTask);
      console.log("[CTOAgent] Session ID:", sessionId);

      if (!replyChannel) {
        console.error("[CTOAgent] No reply channel provided");
        return;
      }

      // Include sessionId in pubSubOptions
      const result = await ctoAgentRunner(userTask, { sessionId });
      console.log("[CTOAgent] CTO result:", result);

      await bus.publish(replyChannel, "CTO_RESULT", {
        output: result.result,
        mode: result.mode,
        contextUsed: result.contextUsed,
        sessionId,
      });

      console.log("[CTOAgent] Successfully published result!");
    } catch (err) {
      console.error("[CTOAgent] Error in handler:", err);
      if (msg?.data?.replyChannel) {
        try {
          await bus.publish(msg.data.replyChannel, "CTO_ERROR", {
            error: err.message || "Unknown error occurred",
            sessionId: msg.data.sessionId,
          });
        } catch (publishErr) {
          console.error("[CTOAgent] Failed to publish error:", publishErr);
        }
      }
    }
  });
}

// Export memory manager for external access
export { memoryManager };
