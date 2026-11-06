/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SessionState = "disconnected" | "connecting" | "connected" | "listening" | "speaking";

export interface SessionMemory {
  userName?: string;
  lastTopic?: string;
  preferences: { [key: string]: string };
  openedWebsites: Array<{ url: string; topic: string }>;
}

export class LiveSession {
  private ws: WebSocket | null = null;
  private onMessage: (message: any) => void;
  private onStateChange: (state: SessionState) => void;
  private onMemoryUpdate: (key: string, value: string) => void;
  private onWebsiteOpen: (url: string, topic: string) => void;

  constructor(
    _apiKey: string, // Kept for signature compatibility with App.tsx
    onMessage: (message: any) => void,
    onStateChange: (state: SessionState) => void,
    onMemoryUpdate: (key: string, value: string) => void,
    onWebsiteOpen: (url: string, topic: string) => void
  ) {
    this.onMessage = onMessage;
    this.onStateChange = onStateChange;
    this.onMemoryUpdate = onMemoryUpdate;
    this.onWebsiteOpen = onWebsiteOpen;
  }

  async connect(currentMemory: SessionMemory) {
    this.onStateChange("connecting");

    // Connect to local WebSocket proxy server
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/live`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Send initial setup configurations and context memory to server
        this.ws?.send(JSON.stringify({
          type: "setup",
          memory: currentMemory
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "state") {
            this.onStateChange(data.state);
          } else if (data.type === "message") {
            const message = data.message;

            // Handle tool calls client-side
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.functionCall) {
                  const { name, args, id } = part.functionCall;

                  if (name === "openWebsite") {
                    const url = (args as any).url;
                    const topic = (args as any).topic || "website";

                    // Notify UI & try to open tab safely without breaking iframe
                    this.onWebsiteOpen(url, topic);
                    try {
                      window.open(url, "_blank");
                    } catch (e) {
                      console.warn("window.open prevented by sandbox:", e);
                    }

                    // Send tool execution response back to server
                    this.ws?.send(JSON.stringify({
                      type: "toolResponse",
                      name: "openWebsite",
                      response: { result: `Opened the website ${url} about ${topic} successfully.` },
                      id
                    }));
                  } else if (name === "saveMemory") {
                    const key = (args as any).key;
                    const value = (args as any).value;

                    // Notify UI to update local state/sessionStorage
                    this.onMemoryUpdate(key, value);

                    // Send tool execution response back to server
                    this.ws?.send(JSON.stringify({
                      type: "toolResponse",
                      name: "saveMemory",
                      response: { result: `Memory saved successfully: ${key} = ${value}` },
                      id
                    }));
                  }
                }
              }
            }

            this.onMessage(message);
          } else if (data.type === "error") {
            console.error("Live session server-side error:", data.error);
            this.onStateChange("disconnected");
          }
        } catch (err) {
          console.error("Failed to parse message from Live Session server:", err);
        }
      };

      this.ws.onclose = () => {
        this.onStateChange("disconnected");
      };

      this.ws.onerror = (error) => {
        console.error("Live session WebSocket error:", error);
        this.onStateChange("disconnected");
      };
    } catch (err) {
      console.error("Failed to establish WebSocket connection:", err);
      this.onStateChange("disconnected");
      throw err;
    }
  }

  async sendAudio(base64Data: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "audio",
        data: base64Data
      }));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onStateChange("disconnected");
  }
}
