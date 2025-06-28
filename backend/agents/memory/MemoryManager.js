import VectorMemory from "./VectorMemory.js";

class MemoryManager {
  constructor(agentType = "cmo") {
    this.agentType = agentType;
    this.vectorMemory = new VectorMemory(`${agentType}-memory`);
    this.sessionMemory = new Map();
    this.isReady = false;
    this.initializationError = null;
  }

  async initialize() {
    try {
      console.log(
        `[MemoryManager] Initializing for ${this.agentType} agent...`
      );

      // Check environment variables first
      if (!process.env.GOOGLE_API_KEY) {
        throw new Error("GOOGLE_API_KEY environment variable is required");
      }

      await this.vectorMemory.initialize();
      this.isReady = true;
      this.initializationError = null;

      const stats = await this.vectorMemory.getMemoryStats();
      console.log(
        `[MemoryManager] Initialized for ${this.agentType} agent:`,
        stats
      );

      if (this.vectorMemory.isUsingFallback()) {
        console.warn(
          `[MemoryManager] Running in fallback mode - vector search disabled`
        );
      }
    } catch (error) {
      console.warn(
        `[MemoryManager] Failed to initialize, using minimal mode:`,
        error.message
      );
      this.isReady = false;
      this.initializationError = error.message;

      // Force fallback mode if vector memory exists
      if (this.vectorMemory) {
        this.vectorMemory.forceFallbackMode();
      }
    }
  }

  async storeInteraction(userTask, result, sessionId = "default") {
    if (!userTask || !result) {
      console.warn("[MemoryManager] Invalid interaction data provided");
      return;
    }

    // Session memory works regardless of vector memory status
    if (!this.sessionMemory.has(sessionId)) {
      this.sessionMemory.set(sessionId, []);
    }

    const interaction = {
      userTask: String(userTask),
      result: String(result),
      timestamp: new Date().toISOString(),
    };

    this.sessionMemory.get(sessionId).push(interaction);

    // Keep only last 20 interactions per session
    const sessionHistory = this.sessionMemory.get(sessionId);
    if (sessionHistory.length > 20) {
      this.sessionMemory.set(sessionId, sessionHistory.slice(-20));
    }

    // Try vector storage if available
    if (this.vectorMemory) {
      try {
        await this.vectorMemory.storeMemory(userTask, result, {
          sessionId,
          agentType: this.agentType,
        });
      } catch (error) {
        console.warn(`[MemoryManager] Vector storage failed:`, error.message);
      }
    }

    console.log(
      `[MemoryManager] Stored interaction for session: ${sessionId} (${sessionHistory.length} total)`
    );
  }

  async getRelevantContext(query, sessionId = "default", options = {}) {
    const { includeSession = true, vectorTopK = 3, sessionLimit = 5 } = options;

    if (!query) {
      console.warn(
        "[MemoryManager] Empty query provided for context retrieval"
      );
      return [];
    }

    let context = [];

    // Try vector context first (if available and not in fallback mode)
    if (this.vectorMemory && !this.vectorMemory.isUsingFallback()) {
      try {
        const vectorContext = await this.vectorMemory.retrieveContext(
          query,
          vectorTopK
        );
        context.push(
          ...vectorContext.map((item) => ({
            type: "vector",
            ...item,
          }))
        );
        console.log(
          `[MemoryManager] Retrieved ${vectorContext.length} vector context items`
        );
      } catch (error) {
        console.warn(`[MemoryManager] Vector retrieval failed:`, error.message);
      }
    }

    // Add session context
    if (includeSession && this.sessionMemory.has(sessionId)) {
      const sessionHistory = this.sessionMemory.get(sessionId);
      const sessionContext = sessionHistory
        .slice(-sessionLimit)
        .map((interaction) => ({
          type: "session",
          content: `Previous: ${interaction.userTask} -> ${interaction.result}`,
          metadata: {
            timestamp: interaction.timestamp,
            sessionId: sessionId,
          },
        }));

      context.unshift(...sessionContext);
      console.log(
        `[MemoryManager] Retrieved ${sessionContext.length} session context items`
      );
    }

    console.log(`[MemoryManager] Total context items: ${context.length}`);
    return context;
  }

  formatContextForPrompt(contextItems) {
    if (!contextItems || contextItems.length === 0) {
      return "";
    }

    const sessionContext = contextItems
      .filter((item) => item.type === "session")
      .map((item) => item.content)
      .join("\n");

    const vectorContext = contextItems
      .filter((item) => item.type === "vector")
      .map((item) => item.content)
      .join("\n");

    let formatted = "";

    if (sessionContext) {
      formatted += `Recent Session Context:\n${sessionContext}\n\n`;
    }

    if (vectorContext) {
      formatted += `Relevant Historical Context:\n${vectorContext}\n\n`;
    }

    return formatted;
  }

  // Clear session memory
  clearSession(sessionId = "default") {
    const hadSession = this.sessionMemory.has(sessionId);
    this.sessionMemory.delete(sessionId);
    console.log(
      `[MemoryManager] Cleared session: ${sessionId} (existed: ${hadSession})`
    );
  }

  // Clear all memory
  async clearAllMemory() {
    const sessionCount = this.sessionMemory.size;
    this.sessionMemory.clear();

    if (this.vectorMemory) {
      try {
        await this.vectorMemory.clearMemory();
        console.log(
          `[MemoryManager] Cleared all memory (${sessionCount} sessions + vector store)`
        );
      } catch (error) {
        console.error("[MemoryManager] Failed to clear vector memory:", error);
      }
    } else {
      console.log(
        `[MemoryManager] Cleared session memory (${sessionCount} sessions)`
      );
    }
  }

  // Get memory statistics
  async getMemoryStatus() {
    const status = {
      agentType: this.agentType,
      isReady: this.isReady,
      initializationError: this.initializationError,
      sessionCount: this.sessionMemory.size,
      sessions: Array.from(this.sessionMemory.keys()),
      vectorMemory: null,
    };

    if (this.vectorMemory) {
      try {
        status.vectorMemory = await this.vectorMemory.getMemoryStats();
      } catch (error) {
        status.vectorMemory = { error: error.message };
      }
    }

    return status;
  }

  // Health check
  async healthCheck() {
    const health = {
      sessionMemory: true,
      vectorMemory: false,
      embeddings: false,
    };

    try {
      // Check if we can store and retrieve from session memory
      const testSessionId = "health-check";
      await this.storeInteraction("test task", "test result", testSessionId);
      const context = await this.getRelevantContext("test", testSessionId);
      this.clearSession(testSessionId);
      health.sessionMemory = context.length > 0;
    } catch (error) {
      health.sessionMemory = false;
    }

    if (this.vectorMemory) {
      try {
        const stats = await this.vectorMemory.getMemoryStats();
        health.vectorMemory =
          stats.mode === "chromadb" && stats.status === "connected";
        health.embeddings = !this.vectorMemory.isUsingFallback();
      } catch (error) {
        health.vectorMemory = false;
        health.embeddings = false;
      }
    }

    return health;
  }
}

export default MemoryManager;
