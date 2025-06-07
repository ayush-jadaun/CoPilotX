import { createReactAgent, AgentExecutor } from "langchain/agents";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { cmoAgentPrompt } from "../prompts/cmoAgentPromt.js";
import MessageBus from "../utills/MemoryBus.js";
import MemoryManager from "./memory/MemoryManager.js";

const bus = new MessageBus("cmo");

let memoryManager = null;
try {
  memoryManager = new MemoryManager("cmo");
  await memoryManager.initialize();
  console.log("[CMOAgent] Memory system initialized");
} catch (error) {
  console.warn("[CMOAgent] Memory system failed to initialize, running without memory:", error.message);
  memoryManager = null;
}

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

export async function runCMOAgent(userTask, pubSubOptions = {}) {
  try {
    console.log("Starting CMO agent with task:", userTask);
    
    const sessionId = pubSubOptions.sessionId || 'default';
    let contextItems = [];
    let enhancedInput = userTask;
    let mode = "simple";
    
    // Try to get context if memory system is available
    if (memoryManager) {
      try {
        contextItems = await memoryManager.getRelevantContext(userTask, sessionId, {
          vectorTopK: 3,
          sessionLimit: 3
        });
        
        if (contextItems.length > 0) {
          const contextString = memoryManager.formatContextForPrompt(contextItems);
          enhancedInput = contextString 
            ? `${contextString}Current Task: ${userTask}`
            : userTask;
          mode = "contextual";
          console.log("Using context:", contextItems.length, "items");
        }
      } catch (error) {
        console.warn("[CMOAgent] Context retrieval failed:", error.message);
      }
    }
    
    console.log("Using CMO agent...");
    
    const agentResult = await cmoAgentExecutor.invoke({
      input: enhancedInput,
    });
    
    const result = agentResult.output ?? agentResult;
    
    // Store interaction if memory system is available
    if (memoryManager) {
      try {
        await memoryManager.storeInteraction(userTask, result, sessionId);
      } catch (error) {
        console.warn("[CMOAgent] Failed to store interaction:", error.message);
      }
    }
    
    if (pubSubOptions.publishResult) {
      await bus.publish(
        pubSubOptions.publishChannel || "agent.cmo",
        "CMO_RESULT",
        {
          userTask,
          mode,
          result,
          contextUsed: contextItems.map(item => ({
            type: item.type,
            timestamp: item.metadata?.timestamp
          })),
        }
      );
    }
    
    return { mode, result, contextUsed: contextItems.length };
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

// Enhanced subscription handler with session support
export function subscribeToCMOTasks(cmoAgentRunner = runCMOAgent) {
  bus.subscribe("agent.cmo.task", async (msg) => {
    try {
      console.log("[CMOAgent] Processing message:", msg);
      const data = msg.data || msg;
      
      if (!data || !data.userTask) {
        console.error("[CMOAgent] Invalid message format:", msg);
        return;
      }
      
      const { userTask, replyChannel, sessionId } = data;
      console.log("[CMOAgent] Received CMO task:", userTask);
      console.log("[CMOAgent] Session ID:", sessionId);
      
      if (!replyChannel) {
        console.error("[CMOAgent] No reply channel provided");
        return;
      }
      
      // Include sessionId in pubSubOptions
      const result = await cmoAgentRunner(userTask, { sessionId });
      console.log("[CMOAgent] CMO result:", result);
      
      await bus.publish(replyChannel, "CMO_RESULT", {
        output: result.result,
        mode: result.mode,
        contextUsed: result.contextUsed,
        sessionId
      });
      
      console.log("[CMOAgent] Successfully published result!");
    } catch (err) {
      console.error("[CMOAgent] Error in handler:", err);
      if (msg?.data?.replyChannel) {
        try {
          await bus.publish(msg.data.replyChannel, "CMO_ERROR", {
            error: err.message || "Unknown error occurred",
            sessionId: msg.data.sessionId
          });
        } catch (publishErr) {
          console.error("[CMOAgent] Failed to publish error:", publishErr);
        }
      }
    }
  });
}

// Export memory manager for external access
export { memoryManager };
