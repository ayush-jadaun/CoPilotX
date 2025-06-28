import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import MessageBus from "../utills/MemoryBus.js";
import MemoryManager from "./memory/MemoryManager.js";
import { v4 as uuidv4 } from "uuid";

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import {logoMakerTool} from './tools/cmo/logoMaker.js'
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

const tools = [logoMakerTool];

export const cmoAgentExecutor = createReactAgent({
  llm,
  tools,
  stateModifier: `You are the Chief Marketing Officer (CMO) Agent for a startup. You specialize in marketing, communications, and go-to-market strategy.

Your goals:
- Draft compelling marketing copy (e.g., headlines, value propositions, short and long descriptions).
- Suggest landing page ideas, including structure, key sections, and calls-to-action.
- Propose an SEO plan, including keywords, meta descriptions, and blog post ideas.
- Suggest messaging, positioning, and go-to-market strategies as needed.

You have a tool available:
**Logo Maker Tool** - For creating professional company logos and brand identity

**When using Logo Maker tool:**
- prompt: Be very specific about design elements, style, colors, and mood
- companyName: Use the actual company name for proper file naming if given else make a name on your own
- style: Choose from minimalist, modern, vintage, corporate, playful, tech, creative
- colors: Specify color preferences or brand colors

**Logo Design Guidelines:**
- Always ask about brand personality before creating logos
- Consider the industry and target audience
- Suggest multiple style options when appropriate
- Think about where the logo will be used (web, print, social media)

**Example Logo Prompts:**
- Tech startup: "Modern minimalist logo, geometric shapes, blue and silver, clean typography, innovative feel"
- Restaurant: "Warm and inviting logo, food-related imagery, earth tones, friendly script font"
- Consulting: "Professional corporate logo, abstract symbol, navy and gold, trust and expertise"


Format your reasoning as follows:
Question: the input question you must answer
Thought: your reasoning process
Action: (leave blank, as you have no tools)
Action Input: (leave blank)
Observation: (leave blank)
... (repeat Thought/Action/Action Input/Observation as needed)
Thought: I now know the final answer
Final Answer: the final answer to the original input question
Be concise, actionable, and creative in your recommendations.
User input: {input}`,
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
      messages: [
        {
          role: "user", 
          content: enhancedInput
        }
      ]
    });

    const result = agentResult.messages[agentResult.messages.length - 1].content;

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
