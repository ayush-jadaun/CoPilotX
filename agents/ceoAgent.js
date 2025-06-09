import { createReactAgent, AgentExecutor } from "langchain/agents";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ceoAgentPrompt } from "../prompts/ceoAgentPromt.js";
import MessageBus from "../utills/MemoryBus.js";
import MemoryManager from "./memory/MemoryManager.js";

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

const tools = [];

const agent = await createReactAgent({
    llm,
    tools,
    prompt: ceoAgentPrompt,
});

export const ceoAgentExecutor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
    maxIterations: 20,
    returnIntermediateSteps: true,
    handleParsingErrors: true,
});

export async function runCEOAgent(userTask, pubSubOptions = {}) {
    try {
        console.log("Starting CEO agent with task:", userTask);

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
                console.warn("[CEOAgent] Context retrieval failed:", error.message);
            }
        }

        console.log("Using CEO agent...");

        const agentResult = await ceoAgentExecutor.invoke({
            input: enhancedInput,
        });

        const result = agentResult.output ?? agentResult;

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

export function subscribeToCEOTasks(ceoAgentRunner = runCEOAgent) {
    bus.subscribe("agent.ceo.task", async (msg) => {
        try {
            console.log("[CEOAgent] Processing message:", msg);
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
}

export { memoryManager };
