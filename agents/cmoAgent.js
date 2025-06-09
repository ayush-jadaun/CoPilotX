import { createReactAgent, AgentExecutor } from "langchain/agents";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { cmoAgentPrompt } from "../prompts/cmoAgentPromt.js";
import MessageBus from "../utills/MemoryBus.js";
import MemoryManager from "./memory/MemoryManager.js";
import { v4 as uuidv4 } from "uuid";

const bus = new MessageBus("cmo");

let memoryManager = null;
try {
  memoryManager = new MemoryManager("cmo");
  await memoryManager.initialize();
  console.log("[CMOAgent] Memory system initialized");
} catch (error) {
  console.warn(
    "[CMOAgent] Memory system failed to initialize, running without memory:",
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

async function waitForAgentReply(bus, replyChannel, agent, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const handler = (msg) => {
      console.log(
        `[AGENT-COMM] [CMO] Got reply from ${agent.toUpperCase()} on ${replyChannel}:`,
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

export async function runCMOAgent(userTask, pubSubOptions = {}) {
  try {
    console.log("Starting CMO agent with task:", userTask);

    const sessionId = pubSubOptions.sessionId || "default";
    let contextItems = [];
    let enhancedInput = userTask;
    let mode = "simple";

    // General inter-agent logic
    const agentRequests = extractAgentRequests(userTask, "cmo");
    const interAgentResponses = {};

    for (const req of agentRequests) {
      const { agent, verb, question } = req;
      if (!KNOWN_AGENTS.includes(agent) || agent === "cmo") continue;
      const replyChannel = `cmo.${agent}.collab.reply.${uuidv4()}`;
      const agentRequest = {
        userTask: `CMO requests: ${question}`,
        replyChannel,
        sessionId,
        fromAgent: "cmo",
      };
      console.log(
        `[AGENT-COMM] [CMO→${agent.toUpperCase()}] Sending:`,
        agentRequest
      );
      bus.publish(`agent.${agent}.request`, agentRequest);

      try {
        const reply = await waitForAgentReply(bus, replyChannel, agent, 30000);
        interAgentResponses[agent] =
          reply.output || reply.data?.output || JSON.stringify(reply);
        console.log(
          `[AGENT-COMM] [${agent.toUpperCase()}→CMO] Reply received:`,
          interAgentResponses[agent]
        );
        mode = "agent-collab";
      } catch (err) {
        interAgentResponses[
          agent
        ] = `No reply from ${agent.toUpperCase()} (timeout).`;
        console.warn(
          `[AGENT-COMM] [CMO] ${agent.toUpperCase()} did not reply in time!`
        );
        mode = "agent-collab";
      }
    }

    // Add all agent replies to the input for the LLM
    if (Object.keys(interAgentResponses).length > 0) {
      for (const [agent, response] of Object.entries(interAgentResponses)) {
        enhancedInput += `\n\n${agent.toUpperCase()}'s response: ${response}\n`;
      }
    }

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
          contextUsed: contextItems.map((item) => ({
            type: item.type,
            timestamp: item.metadata?.timestamp,
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

// Orchestrator and inter-agent request handling
export function subscribeToCMOTasks(cmoAgentRunner = runCMOAgent) {
  // Orchestrator main tasks
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

      const result = await cmoAgentRunner(userTask, { sessionId });
      console.log("[CMOAgent] CMO result:", result);

      await bus.publish(replyChannel, "CMO_RESULT", {
        output: result.result,
        mode: result.mode,
        contextUsed: result.contextUsed,
        sessionId,
      });

      console.log("[CMOAgent] Successfully published result!");
    } catch (err) {
      console.error("[CMOAgent] Error in handler:", err);
      if (msg?.data?.replyChannel) {
        try {
          await bus.publish(msg.data.replyChannel, "CMO_ERROR", {
            error: err.message || "Unknown error occurred",
            sessionId: msg.data.sessionId,
          });
        } catch (publishErr) {
          console.error("[CMOAgent] Failed to publish error:", publishErr);
        }
      }
    }
  });

  // Agent-to-agent requests
  bus.subscribe("agent.cmo.request", async (msg) => {
    try {
      console.log("[CMOAgent] Processing agent-to-agent request:", msg);
      const data = msg.data || msg;

      if (!data || !data.userTask || !data.replyChannel) {
        console.error("[CMOAgent] Invalid inter-agent message format:", msg);
        return;
      }

      const { userTask, replyChannel, sessionId, fromAgent } = data;
      console.log(
        `[CMOAgent] Received agent-to-agent request from ${fromAgent}:`,
        userTask
      );

      const result = await runCMOAgent(userTask, { sessionId });

      await bus.publish(replyChannel, "CMO_REPLY", {
        output: result.result,
        mode: result.mode,
        contextUsed: result.contextUsed,
        sessionId,
      });

      console.log(`[CMOAgent] Replied to ${fromAgent} on ${replyChannel}`);
    } catch (err) {
      console.error("[CMOAgent] Error in agent-to-agent handler:", err);
      if (msg?.data?.replyChannel) {
        try {
          await bus.publish(msg.data.replyChannel, "CMO_ERROR", {
            error: err.message || "Unknown error occurred",
            sessionId: msg.data.sessionId,
          });
        } catch (publishErr) {
          console.error("[CMOAgent] Failed to publish error:", publishErr);
        }
      }
    }
  });
}

export { memoryManager };
