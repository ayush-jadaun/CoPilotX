import { Chroma } from "@langchain/community/vectorstores/chroma";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

class VectorMemory {
  constructor(collectionName) {
    this.collectionName = collectionName;
    this.taskType = collectionName.replace("-memory", "");
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "text-embedding-004",
    });
    this.vectorStore = null;
    this.initialized = false;
    this.fallbackMode = false;
  }

  async initialize() {
    if (this.initialized) return;

    // Check if GOOGLE_API_KEY is available
    if (!process.env.GOOGLE_API_KEY) {
      console.warn(
        "[VectorMemory] GOOGLE_API_KEY not found, using fallback mode"
      );
      this.fallbackMode = true;
      this.initialized = true;
      this.fallbackMemory = [];
      return;
    }

    try {
      // Test embeddings first
      console.log("[VectorMemory] Testing embeddings...");
      await this.embeddings.embedQuery("test connection");
      console.log("[VectorMemory] Embeddings working");

      // Initialize ChromaDB with minimal configuration
      this.vectorStore = new Chroma(this.embeddings, {
        collectionName: this.collectionName,
        url: process.env.CHROMA_URL || "http://localhost:8000",
      });

      // Test connection with a simple operation
      await this.testConnection();
      this.initialized = true;
      this.fallbackMode = false;
      console.log(
        `[VectorMemory] ChromaDB initialized with collection: ${this.collectionName}`
      );
    } catch (error) {
      console.warn(
        "[VectorMemory] ChromaDB not available, using fallback mode:",
        error.message
      );
      console.warn("[VectorMemory] Full error:", error);
      this.fallbackMode = true;
      this.initialized = true;
      this.fallbackMemory = [];
    }
  }

  async testConnection() {
    try {
      // First try to get the collection info
      console.log("[VectorMemory] Testing ChromaDB connection...");

      // Try a simple similarity search - if collection doesn't exist, it will be created
      try {
        const results = await this.vectorStore.similaritySearch("test", 1);
        console.log(
          "[VectorMemory] Connection test successful (existing collection)"
        );
      } catch (searchError) {
        // Collection might not exist yet, try adding a document
        console.log(
          "[VectorMemory] Collection might be new, testing with document..."
        );
        const testDoc = {
          pageContent: "Connection test document",
          metadata: {
            test: true,
            timestamp: new Date().toISOString(),
            id: "test-connection",
          },
        };

        await this.vectorStore.addDocuments([testDoc]);
        console.log("[VectorMemory] Document added successfully");

        // Now try the search again
        const results = await this.vectorStore.similaritySearch("test", 1);
        console.log(
          "[VectorMemory] Connection test successful (new collection)"
        );
      }
    } catch (error) {
      throw new Error(`ChromaDB connection test failed: ${error.message}`);
    }
  }

  async storeMemory(userTask, result, metadata = {}) {
    await this.initialize();

    const document = {
      pageContent: `Task: ${userTask}\nResult: ${result}`,
      metadata: {
        timestamp: new Date().toISOString(),
        taskType: this.taskType,
        id: `${this.taskType}-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        ...metadata,
      },
    };

    try {
      if (this.fallbackMode) {
        if (!this.fallbackMemory) {
          this.fallbackMemory = [];
        }
        this.fallbackMemory.push(document);
        if (this.fallbackMemory.length > 50) {
          this.fallbackMemory = this.fallbackMemory.slice(-50);
        }
        console.log("[VectorMemory] Memory stored in fallback mode");
      } else {
        await this.vectorStore.addDocuments([document]);
        console.log("[VectorMemory] Memory stored in ChromaDB");
      }
    } catch (error) {
      console.error("[VectorMemory] Failed to store memory:", error);
      // Fall back to in-memory storage if ChromaDB fails
      if (!this.fallbackMode) {
        console.warn(
          "[VectorMemory] Switching to fallback mode due to storage error"
        );
        this.fallbackMode = true;
        this.fallbackMemory = this.fallbackMemory || [];
        this.fallbackMemory.push(document);
      }
    }
  }

  async retrieveContext(query, topK = 3) {
    await this.initialize();

    try {
      if (this.fallbackMode) {
        if (!this.fallbackMemory) {
          this.fallbackMemory = [];
        }

        const results = this.fallbackMemory
          .filter(
            (doc) =>
              doc.pageContent.toLowerCase().includes(query.toLowerCase()) ||
              query
                .toLowerCase()
                .split(" ")
                .some((word) => doc.pageContent.toLowerCase().includes(word))
          )
          .slice(-topK);

        console.log(
          `[VectorMemory] Retrieved ${results.length} context items (fallback mode)`
        );
        return results.map((doc) => ({
          content: doc.pageContent,
          metadata: doc.metadata,
        }));
      } else {
        const results = await this.vectorStore.similaritySearch(query, topK);
        console.log(
          `[VectorMemory] Retrieved ${results.length} context items from ChromaDB`
        );
        return results.map((doc) => ({
          content: doc.pageContent,
          metadata: doc.metadata,
        }));
      }
    } catch (error) {
      console.error("[VectorMemory] Failed to retrieve context:", error);
      // If ChromaDB fails, switch to fallback and try again
      if (!this.fallbackMode) {
        console.warn(
          "[VectorMemory] Switching to fallback mode due to retrieval error"
        );
        this.fallbackMode = true;
        this.fallbackMemory = this.fallbackMemory || [];
        return this.retrieveContext(query, topK);
      }
      return [];
    }
  }

  async clearMemory() {
    await this.initialize();

    try {
      if (this.fallbackMode) {
        this.fallbackMemory = [];
        console.log("[VectorMemory] Fallback memory cleared");
      } else {
        // ChromaDB collection deletion
        try {
          await this.vectorStore.delete();
          console.log("[VectorMemory] ChromaDB collection deleted");
        } catch (deleteError) {
          console.warn(
            "[VectorMemory] Standard delete failed, recreating collection:",
            deleteError.message
          );
          // Reinitialize with same collection name
          this.vectorStore = new Chroma(this.embeddings, {
            collectionName: this.collectionName,
            url: process.env.CHROMA_URL || "http://localhost:8000",
          });
          console.log("[VectorMemory] Collection recreated");
        }
      }
    } catch (error) {
      console.error("[VectorMemory] Failed to clear memory:", error);
      throw error;
    }
  }

  // Utility method to check current mode
  isUsingFallback() {
    return this.fallbackMode;
  }

  // Get memory stats
  async getMemoryStats() {
    await this.initialize();

    if (this.fallbackMode) {
      return {
        mode: "fallback",
        count: this.fallbackMemory ? this.fallbackMemory.length : 0,
        maxSize: 50,
      };
    } else {
      try {
        return {
          mode: "chromadb",
          status: "connected",
          collection: this.collectionName,
        };
      } catch (error) {
        return {
          mode: "chromadb",
          status: "error",
          error: error.message,
        };
      }
    }
  }

  // Force fallback mode (useful for testing)
  forceFallbackMode() {
    this.fallbackMode = true;
    this.fallbackMemory = this.fallbackMemory || [];
    console.log("[VectorMemory] Forced into fallback mode");
  }

  // Get current embeddings instance
  getEmbeddings() {
    return this.embeddings;
  }
}

export default VectorMemory;
