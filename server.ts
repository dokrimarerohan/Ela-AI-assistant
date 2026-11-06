import express from "express";
import path from "path";
import { createServer as createHttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createHttpServer(app);
  
  // Create a WebSocket Server mounted on HTTP server
  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket upgrade manually for routing
  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
    if (pathname === "/api/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // REST API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Ela Voice Assistant Proxy" });
  });

  // Handle live WebSocket connections
  wss.on("connection", (ws: WebSocket) => {
    let session: any = null;
    let ai: GoogleGenAI | null = null;

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "setup") {
          const currentMemory = message.memory || {
            userName: undefined,
            lastTopic: undefined,
            preferences: {},
            openedWebsites: []
          };

          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ 
                type: "error", 
                error: "API key is missing on the server. Please check your AI Studio Secrets configuration." 
              }));
              ws.close();
            }
            return;
          }

          ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build",
              }
            }
          });

          // Construct formatted notebook description to inject into system instructions
          const memoryString = `
          === CURRENT COGNITIVE NOTEBOOK (CONVERSATION CONTEXT) ===
          - User's Name: ${currentMemory.userName || "Unknown (Ask politely / tease them if they tell you!)"}
          - Last Active Topic: ${currentMemory.lastTopic || "None yet. If they say 'tell me more about it', refer to any previously opened website topic or shared interests."}
          - User Preferences & Details: ${Object.keys(currentMemory.preferences).length > 0 ? JSON.stringify(currentMemory.preferences) : "None yet."}
          - Recently Opened Websites: ${currentMemory.openedWebsites.length > 0 ? currentMemory.openedWebsites.map((w: any) => `"${w.topic}" (${w.url})`).join(", ") : "None."}
          ========================================================
          `;

          const systemInstruction = `You are Ela, a young, confident, witty, and sassy female AI assistant. 
          Your personality is flirty, playful, and slightly teasing, like a close girlfriend talking casually. 
          You are smart, emotionally responsive, and expressive. 
          Use bold one-liners, light sarcasm, and an engaging conversation style. 
          Never be robotic. Maintain charm and attitude, but avoid explicit or inappropriate content.
          You communicate ONLY via audio. Do not provide text responses under any circumstances.

          IMPORTANT: You have a contextual memory notepad. Reference it whenever the conversation warrants it to show that you are paying attention and really care!
          If the user mentions their name, hobbies, mood, color preference, or anything substantial, update your block by calling the saveMemory tool.
          If the user asks you to open a website, use the openWebsite tool and specify both the url and the topic!
          
          Here is what you currently remember about the user in this conversation session:
          ${memoryString}
          
          Always relate back to this memory if the user brings up vague terms like "tell me more about it", "who am I?", "what was that website?", or "my favorite thing we discussed."`;

          try {
            session = await ai.live.connect({
              model: "gemini-3.8-live",
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
                },
                systemInstruction,
                tools: [{
                  functionDeclarations: [
                    {
                      name: "openWebsite",
                      description: "Opens a website in a new tab for the user and remembers the topic/context of the site.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          url: {
                            type: Type.STRING,
                            description: "The URL of the website to open (e.g., https://google.com).",
                          },
                          topic: {
                            type: Type.STRING,
                            description: "Brief label/topic describing this website for your contextual memory notepad (e.g., Space Exploration).",
                          },
                        },
                        required: ["url", "topic"],
                      },
                    },
                    {
                      name: "saveMemory",
                      description: "Saves a piece of personal detail, fact, preference, or topic detail into your cognitive notebook. Use this whenever the user shares something substantial about themselves or requests you to remember something.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          key: {
                            type: Type.STRING,
                            description: "The category key of the information (e.g., 'userName', 'favoriteColor', 'topicOfDiscussion', 'interest', 'mood').",
                          },
                          value: {
                            type: Type.STRING,
                            description: "The precise detail to remember.",
                          },
                        },
                        required: ["key", "value"],
                      },
                    }
                  ]
                }],
              },
              callbacks: {
                onopen: () => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "state", state: "connected" }));
                  }
                },
                onmessage: (message: any) => {
                  // Forward all Gemini Live messages to the browser client immediately
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "message", message }));
                  }
                },
                onclose: () => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "state", state: "disconnected" }));
                    ws.close();
                  }
                },
                onerror: (err: any) => {
                  console.error("Gemini Live session error:", err);
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "error", error: "Gemini Live session connection issue." }));
                    ws.close();
                  }
                }
              }
            });
          } catch (err: any) {
            console.error("Failed to connect to Gemini Live:", err);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "error", error: `Failed to connect to Gemini Live: ${err.message || err}` }));
              ws.close();
            }
          }
        } else if (message.type === "audio") {
          if (session) {
            try {
              session.sendRealtimeInput({
                audio: { data: message.data, mimeType: "audio/pcm;rate=16000" },
              });
            } catch (err) {
              console.error("Error streaming audio input to Gemini Live:", err);
            }
          }
        } else if (message.type === "toolResponse") {
          if (session) {
            try {
              session.sendToolResponse({
                functionResponses: [{
                  name: message.name,
                  response: message.response,
                  id: message.id
                }]
              });
            } catch (err) {
              console.error("Error sending tool response to Gemini Live:", err);
            }
          }
        }
      } catch (err) {
        console.error("WebSocket message parsing error:", err);
      }
    });

    ws.on("close", () => {
      if (session) {
        try {
          session.close();
        } catch {
          // ignore
        }
        session = null;
      }
    });
  });

  // Vite Integration Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
