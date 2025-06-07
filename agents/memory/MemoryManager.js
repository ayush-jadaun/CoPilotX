import VectorMemory from './VectorMemory.js';

class MemoryManager {
  constructor(agentType = "cmo") {
    this.agentType = agentType;
    this.vectorMemory = new VectorMemory(`${agentType}-memory`);
    this.sessionMemory = new Map();
    this.isReady = false;
  }

  async initialize() {
    try {
      await this.vectorMemory.initialize();
      this.isReady = true;
      console.log(`[MemoryManager] Initialized for ${this.agentType} agent`);
    } catch (error) {
      console.warn(`[MemoryManager] Failed to initialize, using minimal mode:`, error.message);
      this.isReady = false;
    }
  }

  async storeInteraction(userTask, result, sessionId = 'default') {
    // works even if vector memory fails
    if (!this.sessionMemory.has(sessionId)) {
      this.sessionMemory.set(sessionId, []);
    }
    
    const interaction = {
      userTask,
      result,
      timestamp: new Date().toISOString()
    };
    
    this.sessionMemory.get(sessionId).push(interaction);
    
    // only last 20 interactions per session
    const sessionHistory = this.sessionMemory.get(sessionId);
    if (sessionHistory.length > 20) {
      this.sessionMemory.set(sessionId, sessionHistory.slice(-20));
    }

    if (this.isReady) {
      try {
        await this.vectorMemory.storeMemory(userTask, result, {
          sessionId,
          agentType: this.agentType
        });
      } catch (error) {
        console.warn(`[MemoryManager] Vector storage failed:`, error.message);
      }
    }
    
    console.log(`[MemoryManager] Stored interaction for session: ${sessionId}`);
  }

  async getRelevantContext(query, sessionId = 'default', options = {}) {
    const { includeSession = true, vectorTopK = 3, sessionLimit = 5 } = options;
    
    let context = [];
    
    if (this.isReady) {
      try {
        const vectorContext = await this.vectorMemory.retrieveContext(query, vectorTopK);
        context.push(...vectorContext.map(item => ({
          type: 'vector',
          ...item
        })));
      } catch (error) {
        console.warn(`[MemoryManager] Vector retrieval failed:`, error.message);
      }
    }
    
    if (includeSession && this.sessionMemory.has(sessionId)) {
      const sessionContext = this.sessionMemory.get(sessionId)
        .slice(-sessionLimit)
        .map(interaction => ({
          type: 'session',
          content: `Previous: ${interaction.userTask} -> ${interaction.result}`,
          metadata: { timestamp: interaction.timestamp }
        }));
      
      context.unshift(...sessionContext);
    }
    
    return context;
  }

  formatContextForPrompt(contextItems) {
    if (!contextItems || contextItems.length === 0) {
      return "";
    }
    
    const sessionContext = contextItems
      .filter(item => item.type === 'session')
      .map(item => item.content)
      .join('\n');
    
    const vectorContext = contextItems
      .filter(item => item.type === 'vector')
      .map(item => item.content)
      .join('\n');
    
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
  clearSession(sessionId = 'default') {
    this.sessionMemory.delete(sessionId);
    console.log(`[MemoryManager] Cleared session: ${sessionId}`);
  }

  // Clear all memory
  async clearAllMemory() {
    this.sessionMemory.clear();
    await this.vectorMemory.clearMemory();
    console.log("[MemoryManager] Cleared all memory");
  }
}

export default MemoryManager;
