import { Chroma } from "@langchain/community/vectorstores/chroma";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

class VectorMemory {
  constructor(collectionName = "cmo-memory") {
    this.collectionName = collectionName;
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "text-embedding-004",
    });
    this.vectorStore = null;
    this.initialized = false;
    this.fallbackMode = false; // For when ChromaDB is not available
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      this.vectorStore = new Chroma(this.embeddings, {
        collectionName: this.collectionName,
        url: process.env.CHROMA_URL || "http://localhost:8000",
      });
      
      // Test connection
      await this.vectorStore.similaritySearch("test", 1);
      this.initialized = true;
      this.fallbackMode = false;
      console.log(`[VectorMemory] ChromaDB initialized with collection: ${this.collectionName}`);
    } catch (error) {
      console.warn("[VectorMemory] ChromaDB not available, using fallback mode:", error.message);
      this.fallbackMode = true;
      this.initialized = true;
      this.fallbackMemory = [];
    }
  }

  async storeMemory(userTask, result, metadata = {}) {
    await this.initialize();
    
    const document = {
      pageContent: `Task: ${userTask}\nResult: ${result}`,
      metadata: {
        timestamp: new Date().toISOString(),
        taskType: "cmo",
        ...metadata
      }
    };

    try {
      if (this.fallbackMode) {
        this.fallbackMemory.push(document);
        // Keep only last 50 items
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
    }
  }

  async retrieveContext(query, topK = 3) {
    await this.initialize();
    
    try {
      if (this.fallbackMode) {
        const results = this.fallbackMemory
          .filter(doc => 
            doc.pageContent.toLowerCase().includes(query.toLowerCase()) ||
            query.toLowerCase().split(' ').some(word => 
              doc.pageContent.toLowerCase().includes(word)
            )
          )
          .slice(-topK); 
        
        console.log(`[VectorMemory] Retrieved ${results.length} context items (fallback mode)`);
        return results.map(doc => ({
          content: doc.pageContent,
          metadata: doc.metadata
        }));
      } else {
        const results = await this.vectorStore.similaritySearch(query, topK);
        console.log(`[VectorMemory] Retrieved ${results.length} context items from ChromaDB`);
        return results.map(doc => ({
          content: doc.pageContent,
          metadata: doc.metadata
        }));
      }
    } catch (error) {
      console.error("[VectorMemory] Failed to retrieve context:", error);
      return [];
    }
  }

  async clearMemory() {
    await this.initialize();
    
    try {
      // ChromaDB collection deletion
      await this.vectorStore.delete();
      console.log("[VectorMemory] Memory cleared");
    } catch (error) {
      console.error("[VectorMemory] Failed to clear memory:", error);
      throw error;
    }
  }
}

export default VectorMemory;
