import { createReactAgent, AgentExecutor } from "langchain/agents";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { cfoAgentPrompt } from "../prompts/cfoAgentPromt.js";
import MessageBus from "../utills/MemoryBus.js";
import MemoryManager from "./memory/MemoryManager.js";
import { v4 as uuidv4 } from "uuid";

// === GENERAL AGENT-TO-AGENT UTILS (can be shared between agents) ===
const KNOWN_AGENTS = ["ceo", "cfo", "cmo", "cto"];

function extractAgentRequests(userTask, selfAgent) {
  const requests = [];
  const pattern =
    /(check with|ask|confirm with)\s+(the\s+)?(ceo|cfo|cmo|cto)([^.?!]*)[.?!]/gi;
  let match;
  while ((match = pattern.exec(userTask)) !== null) {
    const verb = match[1].toLowerCase();
    const agent = match[3].toLowerCase();
    if (agent === selfAgent) continue;
    let question = match[4] ? match[4].trim() : "";
    if (!question || question.length < 3)
      question = "Please advise on the relevant matter.";
    requests.push({ agent, verb, question });
  }
  return requests;
}

function waitForAgentReply(bus, replyChannel, agent, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const handler = (msg) => {
      console.log(
        `[AGENT-COMM] [CFO] Got reply from ${agent.toUpperCase()} on ${replyChannel}:`,
        msg
      );
      bus.unsubscribe(replyChannel, handler);
      resolve(msg);
    };
    bus.subscribe(replyChannel, handler);
    setTimeout(() => {
      bus.unsubscribe(replyChannel, handler);
      reject(new Error(`Timeout waiting for ${agent.toUpperCase()} reply`));
    }, timeout);
  });
}

// === RETRY UTILITY ===
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.warn(
        `[Retry] Attempt ${attempt + 1}/${maxRetries} failed:`,
        error.message
      );

      if (attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// === ENHANCED LLM CONFIGURATION ===
function createLLMWithFallback() {
  const primaryLLM = new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY,
    model: "models/gemini-2.0-flash",
    temperature: 0,
    // Add streaming configuration
    streaming: false, // Disable streaming to avoid parse issues
  
  });

  // Fallback LLM with different model
  const fallbackLLM = new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY,
    model: "models/gemini-1.5-pro", // Use more stable model as fallback
    temperature: 0,
    streaming: false,
  });

  return { primaryLLM, fallbackLLM };
}

// === AGENT INIT ===
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

const { primaryLLM, fallbackLLM } = createLLMWithFallback();
const tools = [];

// Create agent with primary LLM
const agent = await createReactAgent({
  llm: primaryLLM,
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

// Create fallback agent
const fallbackAgent = await createReactAgent({
  llm: fallbackLLM,
  tools,
  prompt: cfoAgentPrompt,
});

const fallbackAgentExecutor = new AgentExecutor({
  agent: fallbackAgent,
  tools,
  verbose: false, // Less verbose for fallback
  maxIterations: 15,
  returnIntermediateSteps: true,
  handleParsingErrors: true,
});

// === ENHANCED RUNNER WITH ERROR HANDLING ===
export async function runCFOAgent(userTask, pubSubOptions = {}) {
  const sessionId = pubSubOptions.sessionId || "default";

  try {
    console.log("[CFOAgent] Starting CFO agent with task:", userTask);

    let contextItems = [];
    let enhancedInput = userTask;
    let mode = "simple";

    // --- Agent-to-agent collaboration (unchanged) ---
    const agentRequests = extractAgentRequests(userTask, "cfo");
    const interAgentResponses = {};

    for (const req of agentRequests) {
      const { agent, verb, question } = req;
      if (!KNOWN_AGENTS.includes(agent) || agent === "cfo") continue;

      const replyChannel = `cfo.${agent}.collab.reply.${uuidv4()}`;
      const agentRequest = {
        userTask: `CFO requests: ${question}`,
        replyChannel,
        sessionId,
        fromAgent: "cfo",
      };

      console.log(
        `[AGENT-COMM] [CFO→${agent.toUpperCase()}] Sending:`,
        agentRequest
      );
      bus.publish(`agent.${agent}.request`, agentRequest);

      try {
        const reply = await waitForAgentReply(bus, replyChannel, agent, 30000);
        interAgentResponses[agent] =
          reply.output || reply.data?.output || JSON.stringify(reply);
        console.log(
          `[AGENT-COMM] [${agent.toUpperCase()}→CFO] Reply received:`,
          interAgentResponses[agent]
        );
        mode = "agent-collab";
      } catch (err) {
        interAgentResponses[
          agent
        ] = `No reply from ${agent.toUpperCase()} (timeout).`;
        console.warn(
          `[AGENT-COMM] [CFO] ${agent.toUpperCase()} did not reply in time!`
        );
        mode = "agent-collab";
      }
    }

    // Add agent replies to input
    if (Object.keys(interAgentResponses).length > 0) {
      for (const [agent, response] of Object.entries(interAgentResponses)) {
        enhancedInput += `\n\n${agent.toUpperCase()}'s response: ${response}\n`;
      }
    }

    // Context retrieval (unchanged)
    if (memoryManager) {
      try {
        contextItems = await memoryManager.getRelevantContext(
          enhancedInput,
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
            ? `${contextString}Current Task: ${enhancedInput}`
            : enhancedInput;
          if (mode === "simple") mode = "contextual";
          console.log(
            "[CFOAgent] Using context:",
            contextItems.length,
            "items"
          );
        }
      } catch (error) {
        console.warn("[CFOAgent] Context retrieval failed:", error.message);
      }
    }

    // === ENHANCED AGENT EXECUTION WITH RETRY AND FALLBACK ===
    console.log("[CFOAgent] Executing with primary LLM...");

    const executeAgent = async (executor, executorName) => {
      try {
        const result = await executor.invoke({
          input: enhancedInput,
        });
        console.log(`[CFOAgent] ${executorName} execution successful`);
        return result;
      } catch (error) {
        console.error(
          `[CFOAgent] ${executorName} execution failed:`,
          error.message
        );
        throw error;
      }
    };

    let agentResult;

    try {
      // Try primary agent with retry
      agentResult = await retryWithBackoff(
        () => executeAgent(cfoAgentExecutor, "Primary"),
        2, // Fewer retries for primary
        1000
      );
    } catch (primaryError) {
      console.warn("[CFOAgent] Primary LLM failed, trying fallback...");

      try {
        // Try fallback agent
        agentResult = await retryWithBackoff(
          () => executeAgent(fallbackAgentExecutor, "Fallback"),
          1, // Single retry for fallback
          2000
        );
        mode += "-fallback";
      } catch (fallbackError) {
        console.error("[CFOAgent] Both primary and fallback LLMs failed");

        // Last resort: return a basic response
        agentResult = {
          output: `I apologize, but I'm experiencing technical difficulties processing your request: "${userTask}". Please try again in a moment or rephrase your request.`,
        };
        mode += "-error-fallback";

        // Log the errors for debugging
        console.error("[CFOAgent] Primary error:", primaryError.message);
        console.error("[CFOAgent] Fallback error:", fallbackError.message);
      }
    }

    const result = agentResult.output ?? agentResult;

    // Store interaction in memory
    if (memoryManager && result && typeof result === "string") {
      try {
        await memoryManager.storeInteraction(userTask, result, sessionId);
        console.log("[CFOAgent] Interaction stored in memory");
      } catch (error) {
        console.warn("[CFOAgent] Failed to store interaction:", error.message);
      }
    }

    // Publish result
    if (pubSubOptions.publishResult) {
      try {
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
            sessionId,
          }
        );
        console.log("[CFOAgent] Result published successfully");
      } catch (publishError) {
        console.error(
          "[CFOAgent] Failed to publish result:",
          publishError.message
        );
      }
    }

    return { mode, result, contextUsed: contextItems.length };
  } catch (error) {
    console.error("[CFOAgent] Critical error in runCFOAgent:", error);

    // Publish error
    if (pubSubOptions.publishResult) {
      try {
        await bus.publish(
          pubSubOptions.publishChannel || "agent.cfo",
          "CFO_ERROR",
          {
            userTask,
            error: error.message || "Unknown error occurred",
            sessionId,
          }
        );
      } catch (publishError) {
        console.error(
          "[CFOAgent] Failed to publish error:",
          publishError.message
        );
      }
    }

    throw error;
  }
}

// === MESSAGE BUS HANDLERS WITH ENHANCED ERROR HANDLING ===
export function subscribeToCFOTasks(cfoAgentRunner = runCFOAgent) {
  // Enhanced error handler
  const handleError = async (error, msg, context) => {
    console.error(`[CFOAgent] Error in ${context}:`, error);

    if (msg?.data?.replyChannel) {
      try {
        await bus.publish(msg.data.replyChannel, "CFO_ERROR", {
          error: error.message || "Unknown error occurred",
          sessionId: msg.data?.sessionId,
          context,
        });
        console.log(`[CFOAgent] Error published to ${msg.data.replyChannel}`);
      } catch (publishErr) {
        console.error("[CFOAgent] Failed to publish error:", publishErr);
      }
    }
  };

  // Orchestrator main tasks
  bus.subscribe("agent.cfo.task", async (msg) => {
    try {
      console.log("[CFOAgent] Processing orchestrator message:", msg);
      const data = msg.data || msg;

      if (!data || !data.userTask) {
        throw new Error("Invalid message format - missing userTask");
      }

      const { userTask, replyChannel, sessionId } = data;

      if (!replyChannel) {
        throw new Error("No reply channel provided");
      }

      console.log("[CFOAgent] Received CFO task:", userTask);
      console.log("[CFOAgent] Session ID:", sessionId);

      const result = await cfoAgentRunner(userTask, { sessionId });
      console.log("[CFOAgent] CFO result generated successfully");

      await bus.publish(replyChannel, "CFO_RESULT", {
        output: result.result,
        mode: result.mode,
        contextUsed: result.contextUsed,
        sessionId,
      });

      console.log("[CFOAgent] Successfully published result!");
    } catch (err) {
      await handleError(err, msg, "orchestrator-task");
    }
  });

  // Agent-to-agent requests
  bus.subscribe("agent.cfo.request", async (msg) => {
    try {
      console.log("[CFOAgent] Processing agent-to-agent request:", msg);
      const data = msg.data || msg;

      if (!data || !data.userTask || !data.replyChannel) {
        throw new Error("Invalid inter-agent message format");
      }

      const { userTask, replyChannel, sessionId, fromAgent } = data;
      console.log(`[CFOAgent] Received request from ${fromAgent}:`, userTask);

      const result = await runCFOAgent(userTask, { sessionId });

      await bus.publish(replyChannel, "CFO_REPLY", {
        output: result.result,
        mode: result.mode,
        contextUsed: result.contextUsed,
        sessionId,
      });

      console.log(`[CFOAgent] Replied to ${fromAgent} on ${replyChannel}`);
    } catch (err) {
      await handleError(err, msg, "agent-to-agent-request");
    }
  });

  console.log("[CFOAgent] Subscribed to tasks and requests");
}

export { memoryManager };
