import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { pptMakerTool } from "../tools/ceo/newPptMaker.js";
import MessageBus from "../utills/MemoryBus.js";
import MemoryManager from "./memory/MemoryManager.js";
import { v4 as uuidv4 } from "uuid";

import { createReactAgent } from "@langchain/langgraph/prebuilt";

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
        `[AGENT-COMM] [CEO] Got reply from ${agent.toUpperCase()} on ${replyChannel}:`,
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

// === AGENT INIT ===
const bus = new MessageBus("ceo");
let memoryManager = null;
try {
  memoryManager = new MemoryManager("ceo");
  await memoryManager.initialize();
  console.log("[CEOAgent] Memory system initialized");
} catch (error) {
  console.warn(
    "[CEOAgent] Memory system failed to initialize, running without memory:",
    error.message
  );
  memoryManager = null;
}

const llm = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "models/gemini-2.0-flash",
  temperature: 0,
});

// Add the PowerPoint maker tool to the tools array
const tools = [pptMakerTool];

// Langgraph's createReactAgent
export const ceoAgentExecutor = createReactAgent({
  llm,
  tools,
  stateModifier: `You are the CEO Agent for a startup. Your expertise is in refining vision, value proposition, and go-to-market (GTM) strategy.

You have access to a PowerPoint presentation maker tool that can create professional presentations. Use this tool when:
- Asked to create a presentation, pitch deck, or slides
- Need to visualize strategic information
- Want to present findings in a structured format
- Creating investor presentations or board reports

Given the user input, do the following:
- Refine or critique the company's value proposition and vision statement
- Propose improvements to the GTM strategy, including key messaging and target audiences
- Suggest ways to align the team and resources for maximum impact
- Create presentations when requested or when it would be valuable for strategic communication

PowerPoint Tool Usage Examples:
For a startup pitch deck, use the ppt_maker tool with this structure:
- title: "Company Pitch Deck"
- theme: "startup" 
- slides: Array of slide objects with types like "content", "comparison", "conclusion"

For a strategic presentation:
- title: "Strategic Review"
- theme: "corporate"
- slides: Include current state, options analysis, recommendations

Always provide actionable insights and create presentations when they would enhance communication of strategic concepts.

User input: {input}`,
  maxIterations: 4,
  // returnIntermediateSteps: true,

});


export async function deleteCEOMemory(sessionId = "default") {
  try {
    if (
      memoryManager &&
      memoryManager.vectorStore &&
      memoryManager.vectorStore.collectionName
    ) {
      const result = await memoryManager.vectorStore.client.delete(
        memoryManager.vectorStore.collectionName,
        null,
        { sessionId }
      );
      return { success: true, result };
    } else {
      throw new Error("No memory manager or vector store available.");
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// === GENERALIZED RUNNER ===
export async function runCEOAgent(userTask, pubSubOptions = {}) {
  try {
    console.log("Starting CEO agent with task:", userTask);

    const sessionId = pubSubOptions.sessionId || "default";
    let contextItems = [];
    let enhancedInput = userTask;
    let mode = "simple";

    // --- General agent-to-agent collaboration ---
    const agentRequests = extractAgentRequests(userTask, "ceo");
    const interAgentResponses = {};

    for (const req of agentRequests) {
      const { agent, verb, question } = req;
      if (!KNOWN_AGENTS.includes(agent) || agent === "ceo") continue;
      const replyChannel = `ceo.${agent}.collab.reply.${uuidv4()}`;
      const agentRequest = {
        userTask: `CEO requests: ${question}`,
        replyChannel,
        sessionId,
        fromAgent: "ceo",
      };
      console.log(
        `[AGENT-COMM] [CEO→${agent.toUpperCase()}] Sending:`,
        agentRequest
      );
      bus.publish(`agent.${agent}.request`, agentRequest);

      try {
        const reply = await waitForAgentReply(bus, replyChannel, agent, 30000);
        interAgentResponses[agent] =
          reply.output || reply.data?.output || JSON.stringify(reply);
        console.log(
          `[AGENT-COMM] [${agent.toUpperCase()}→CEO] Reply received:`,
          interAgentResponses[agent]
        );
        mode = "agent-collab";
      } catch (err) {
        interAgentResponses[
          agent
        ] = `No reply from ${agent.toUpperCase()} (timeout).`;
        console.warn(
          `[AGENT-COMM] [CEO] ${agent.toUpperCase()} did not reply in time!`
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

    // CONTEXT LOGIC (unchanged)
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
        console.warn("[CEOAgent] Context retrieval failed:", error.message);
      }
    }

    console.log("Using CEO agent...");
    // 
    const agentResult = await ceoAgentExecutor.invoke({
      messages: [
        {
          role: "user", 
          content: enhancedInput
        }
      ]
    });
// 
    const result = agentResult.messages[agentResult.messages.length - 1].content;

    if (memoryManager) {
      try {
        await memoryManager.storeInteraction(userTask, result, sessionId);
      } catch (error) {
        console.warn("[CEOAgent] Failed to store interaction:", error.message);
      }
    }

    if (pubSubOptions.publishResult) {
      await bus.publish(
        pubSubOptions.publishChannel || "agent.ceo",
        "CEO_RESULT",
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
    console.error("CEO agent execution failed:", error);
    if (pubSubOptions.publishResult) {
      await bus.publish(
        pubSubOptions.publishChannel || "agent.ceo",
        "CEO_ERROR",
        {
          userTask,
          error: error.message || error,
        }
      );
    }
    throw error;
  }
}

// Listen for orchestrator main tasks and agent-to-agent requests
export function subscribeToCEOTasks(ceoAgentRunner = runCEOAgent) {
  // Main orchestrator tasks (as before)
  bus.subscribe("agent.ceo.task", async (msg) => {
    try {
      console.log("[CEOAgent] Processing orchestrator message:", msg);
      const data = msg.data || msg;

      if (!data || !data.userTask) {
        console.error("[CEOAgent] Invalid message format:", msg);
        return;
      }

      const { userTask, replyChannel, sessionId } = data;
      console.log("[CEOAgent] Received CEO task:", userTask);
      console.log("[CEOAgent] Session ID:", sessionId);

      if (!replyChannel) {
        console.error("[CEOAgent] No reply channel provided");
        return;
      }

      const result = await ceoAgentRunner(userTask, { sessionId });
      console.log("[CEOAgent] CEO result:", result);

      await bus.publish(replyChannel, "CEO_RESULT", {
        output: result.result,
        mode: result.mode,
        contextUsed: result.contextUsed,
        sessionId,
      });

      console.log("[CEOAgent] Successfully published result!");
    } catch (err) {
      console.error("[CEOAgent] Error in handler:", err);
      if (msg?.data?.replyChannel) {
        try {
          await bus.publish(msg.data.replyChannel, "CEO_ERROR", {
            error: err.message || "Unknown error occurred",
            sessionId: msg.data.sessionId,
          });
        } catch (publishErr) {
          console.error("[CEOAgent] Failed to publish error:", publishErr);
        }
      }
    }
  });

  // Agent-to-agent requests (from CTO, CMO, CFO, etc.)
  bus.subscribe("agent.ceo.request", async (msg) => {
    try {
      console.log("[CEOAgent] Processing agent-to-agent request:", msg);
      const data = msg.data || msg;

      if (!data || !data.userTask || !data.replyChannel) {
        console.error("[CEOAgent] Invalid inter-agent message format:", msg);
        return;
      }

      const { userTask, replyChannel, sessionId, fromAgent } = data;
      console.log(
        `[CEOAgent] Received agent-to-agent request from ${fromAgent}:`,
        userTask
      );

      // Optionally: use a different runner, or check if the request is allowed/handled
      const result = await runCEOAgent(userTask, { sessionId });

      await bus.publish(replyChannel, "CEO_REPLY", {
        output: result.result,
        mode: result.mode,
        contextUsed: result.contextUsed,
        sessionId,
      });

      console.log(`[CEOAgent] Replied to ${fromAgent} on ${replyChannel}`);
    } catch (err) {
      console.error("[CEOAgent] Error in agent-to-agent handler:", err);
      if (msg?.data?.replyChannel) {
        try {
          await bus.publish(msg.data.replyChannel, "CEO_ERROR", {
            error: err.message || "Unknown error occurred",
            sessionId: msg.data.sessionId,
          });
        } catch (publishErr) {
          console.error("[CEOAgent] Failed to publish error:", publishErr);
        }
      }
    }
  });
}

export { memoryManager };
