import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import MessageBus from "../utills/MemoryBus.js";
import MemoryManager from "./memory/MemoryManager.js";
import { v4 as uuidv4 } from "uuid"; // npm install uuid
import { generateReadmeTool } from "../tools/ceo/generateReadmeTool";

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

const llm = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "models/gemini-2.0-flash",
  temperature: 0,
});

const tools = [generateReadmeTool];


export const ctoAgentExecutor = createReactAgent({
  llm,
  tools,
  stateModifier: `You are the CTO Agent for a startup. Your expertise is in technology leadership, software architecture, and rapid MVP development.
Given input, do the following:
- Suggest an MVP (Minimum Viable Product) architecture, including system components and data flows.
- Recommend a modern, scalable tech stack (frontend, backend, database, hosting, etc).
- Propose APIs or integrations needed, including example endpoints and data models.
- Offer rationale for your choices, focusing on startup speed and scalability.

You have access to tools to perform certain tasks, use it wisely.

Use the following format:
Question: the input question you must answer
Thought: you should always think about what to do
Action: (leave blank, as you have no tools)
Action Input: (leave blank)
Observation: (leave blank)
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question
User input: {input}`,
  verbose: true,
  maxIterations: 20,
  returnIntermediateSteps: true,
  handleParsingErrors: true,
});

// ---- GENERAL AGENT-TO-AGENT COMMUNICATION LOGIC ----

const KNOWN_AGENTS = ["ceo", "cfo", "cmo", "cto"]; // Add other agent types as needed

function extractAgentRequests(userTask) {
  // RegEx to find "check with/ask/confirm with <agent>" patterns
  // e.g. "CTO, check with CMO about integrations and with CFO about budget limits."
  const requests = [];
  const pattern =
    /(check with|ask|confirm with)\s+(the\s+)?(ceo|cfo|cmo|cto)([^.?!]*)[.?!]/gi;
  let match;
  while ((match = pattern.exec(userTask)) !== null) {
    const verb = match[1].toLowerCase();
    const agent = match[3].toLowerCase();
    let question = match[4] ? match[4].trim() : "";
    // Clean up question text
    if (!question || question.length < 3)
      question = "Please advise on the relevant matter.";
    requests.push({ agent, verb, question });
  }
  return requests;
}

async function waitForAgentReply(replyChannel, agent, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const handler = (msg) => {
      console.log(
        `[AGENT-COMM] [CTO] Got reply from ${agent.toUpperCase()} on ${replyChannel}:`,
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

export async function runCTOAgent(userTask, pubSubOptions = {}) {
  try {
    console.log("Starting CTO agent with task:", userTask);

    const sessionId = pubSubOptions.sessionId || "default";
    let contextItems = [];
    let enhancedInput = userTask;
    let mode = "simple";

    // ---- GENERAL INTER-AGENT PATCH ----
    const agentRequests = extractAgentRequests(userTask);
    const interAgentResponses = {};

    for (const req of agentRequests) {
      const { agent, verb, question } = req;
      if (!KNOWN_AGENTS.includes(agent) || agent === "cto") continue;
      const replyChannel = `cto.${agent}.collab.reply.${uuidv4()}`;
      const agentRequest = {
        userTask: `CTO requests: ${question}`,
        replyChannel,
        sessionId,
        fromAgent: "cto",
      };
      console.log(
        `[AGENT-COMM] [CTO→${agent.toUpperCase()}] Sending:`,
        agentRequest
      );
      bus.publish(`agent.${agent}.request`, agentRequest);

      try {
        const reply = await waitForAgentReply(replyChannel, agent, 30000);
        interAgentResponses[agent] =
          reply.output || reply.data?.output || JSON.stringify(reply);
        console.log(
          `[AGENT-COMM] [${agent.toUpperCase()}→CTO] Reply received:`,
          interAgentResponses[agent]
        );
        mode = "agent-collab";
      } catch (err) {
        interAgentResponses[
          agent
        ] = `No reply from ${agent.toUpperCase()} (timeout).`;
        console.warn(
          `[AGENT-COMM] [CTO] ${agent.toUpperCase()} did not reply in time!`
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

    // ---- CONTEXT LOGIC (unchanged) ----
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
        console.warn("[CTOAgent] Context retrieval failed:", error.message);
      }
    }

    console.log("Using CTO agent...");
    const agentResult = await ctoAgentExecutor.invoke({
      messages: [
        {
          role: "user", 
          content: enhancedInput
        }
      ]
    });

    const result = agentResult.messages[result.messages.length - 1].content;

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

// Handles orchestrator and inter-agent requests in parallel
export function subscribeToCTOTasks(ctoAgentRunner = runCTOAgent) {
  // Orchestrator main tasks
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

  // Agent-to-agent requests (e.g., from CEO, CMO, CFO)
  bus.subscribe("agent.cto.request", async (msg) => {
    try {
      console.log("[CTOAgent] Processing agent-to-agent request:", msg);
      const data = msg.data || msg;

      if (!data || !data.userTask || !data.replyChannel) {
        console.error("[CTOAgent] Invalid inter-agent message format:", msg);
        return;
      }

      const { userTask, replyChannel, sessionId, fromAgent } = data;
      console.log(
        `[CTOAgent] Received agent-to-agent request from ${fromAgent}:`,
        userTask
      );

      const result = await runCTOAgent(userTask, { sessionId });

      await bus.publish(replyChannel, "CTO_REPLY", {
        output: result.result,
        mode: result.mode,
        contextUsed: result.contextUsed,
        sessionId,
      });

      console.log(`[CTOAgent] Replied to ${fromAgent} on ${replyChannel}`);
    } catch (err) {
      console.error("[CTOAgent] Error in agent-to-agent handler:", err);
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

export { memoryManager };
