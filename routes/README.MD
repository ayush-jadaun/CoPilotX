# Vector Memory API Usage Guide

This guide explains how to test and use the vector memory API for different agents (e.g., `cmo`, `ceo`, `cto`, `coo`) using Postman or any HTTP client.

---

## 1. Store Memory

**Endpoint:**  
`POST http://localhost:3000/vector-memory/{agent}/store`  
Replace `{agent}` with your desired agent (`cmo`, `ceo`, `cto`, `coo`, etc.).

**Request Body (JSON):**
```json
{
  "userTask": "Add press mention about the launch of AI-powered analytics platform.",
  "result": "TechCrunch featured our new AI-powered analytics platform, highlighting its real-time data insights and usability for marketers.",
  "sessionId": "press-mentions-2025",
  "metadata": {
    "source": "TechCrunch",
    "date": "2025-05-20",
    "link": "https://techcrunch.com/article/ai-analytics-launch"
  }
}
```
**Instructions:**  
- In Postman, set the method to `POST`.
- Enter the URL (replace `{agent}`).
- Go to the **Body** tab → select **raw** → select **JSON** and paste the body above.
- Click **Send**.
- You should see a success JSON response.

---

## 2. Query Memory

**Endpoint:**  
`POST http://localhost:3000/vector-memory/{agent}/query`  
Replace `{agent}` with your agent type.

**Request Body (JSON):**
```json
{
  "query": "AI-powered analytics platform press mention",
  "sessionId": "press-mentions-2025",
  "options": {
    "includeSession": true,
    "vectorTopK": 3,
    "sessionLimit": 5
  }
}
```
**Instructions:**  
- In Postman, set the method to `POST`.
- Enter the URL (replace `{agent}`).
- Go to the **Body** tab → **raw** → **JSON** and paste the example body.
- Click **Send**.
- The response will return relevant memory entries.

---

## 3. Clear Memory

**Endpoint:**  
`POST http://localhost:3000/vector-memory/{agent}/clear`  
Replace `{agent}` with your agent type.

**Request Body (JSON):**
```json
{}
```
**Instructions:**  
- In Postman, set the method to `POST`.
- Enter the URL (replace `{agent}`).
- **Body** → **raw** → **JSON** and use `{}`.
- Click **Send**.
- The response will confirm the memory was cleared.

---

## 4. Get Memory Status

**Endpoint:**  
`GET http://localhost:3000/vector-memory/{agent}/status`  
Replace `{agent}` with your agent type.

**Instructions:**  
- In Postman, set the method to `GET`.
- Enter the URL (replace `{agent}`).
- No body needed.
- Click **Send**.
- The response will show the status and stats for the agent's memory system.

---

## 🟢 How to Use in Postman

1. Choose the correct HTTP method (`POST` or `GET`).
2. Paste the endpoint URL, replacing `{agent}` with your agent (e.g., `cmo`, `ceo`).
3. For `POST` requests, click the **Body** tab, select **raw**, select **JSON**, and paste the relevant JSON body.
4. Click **Send**.
5. Check the response for success or data.

---

## ℹ️ Notes

- Ensure your API server is running on `localhost:3000`.
- You can test for different agents by changing `{agent}` in the URLs (e.g., `/vector-memory/cmo/store`, `/vector-memory/cto/query`).
- For session-specific operations, use a unique `sessionId` in your requests.
- For more details or troubleshooting, check your server logs for errors or messages.

---