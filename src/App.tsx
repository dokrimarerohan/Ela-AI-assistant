/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Power, Settings, Info, X, Download, Smartphone } from "lucide-react";
import { AudioStreamer } from "./lib/audio-streamer";
import { LiveSession, SessionState, SessionMemory } from "./lib/live-session";
import { Visualizer } from "./components/Visualizer";
import { MemoryNotepad } from "./components/MemoryNotepad";

export default function App() {
  const [state, setState] = useState<SessionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Initialize contextual memory from sessionStorage if it exists
  const [memory, setMemory] = useState<SessionMemory>(() => {
    const saved = sessionStorage.getItem("ela_session_memory");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved session memory:", e);
      }
    }
    return {
      userName: undefined,
      lastTopic: undefined,
      preferences: {},
      openedWebsites: []
    };
  });

  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);

  useEffect(() => {
    const streamer = new AudioStreamer(16000, 24000);
    streamer.onPlaybackStateChange = (isPlaying) => {
      if (!isPlaying) {
        setState((current) => (current === "speaking" ? "listening" : current));
      }
    };
    audioStreamerRef.current = streamer;
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      stopSession();
      setError("Connection lost. I can't talk to you in the dark, babe.");
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      setError("Installed successfully! Now I'm right on your home screen, babe. 😉");
      setTimeout(() => setError(null), 6000);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      stopSession();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Install prompt outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const updateMemory = (key: string, value: string) => {
    setMemory((prev) => {
      let updated = { ...prev };
      if (key === "userName") {
        updated.userName = value;
      } else if (key === "topicOfDiscussion" || key === "topic" || key === "lastTopic") {
        updated.lastTopic = value;
      } else {
        updated.preferences = { ...prev.preferences, [key]: value };
      }
      sessionStorage.setItem("ela_session_memory", JSON.stringify(updated));
      return updated;
    });
  };

  const addOpenedWebsite = (url: string, topic: string) => {
    setMemory((prev) => {
      const updated = {
        ...prev,
        lastTopic: topic,
        openedWebsites: [...prev.openedWebsites, { url, topic }]
      };
      sessionStorage.setItem("ela_session_memory", JSON.stringify(updated));
      return updated;
    });
  };

  const clearMemory = () => {
    const empty: SessionMemory = {
      userName: undefined,
      lastTopic: undefined,
      preferences: {},
      openedWebsites: []
    };
    setMemory(empty);
    sessionStorage.removeItem("ela_session_memory");
    setError("Cognitive notebook cleared, darling. Back containing a fresh clean slate!");
    setTimeout(() => setError(null), 4000);
  };

  const startSession = async () => {
    if (!isOnline) {
      setError("You're offline. Get some bars and try again.");
      return;
    }
    try {
      liveSessionRef.current = new LiveSession(
        "", // API key is safely managed server-side
        (message) => {
          if (message.serverContent?.modelTurn?.parts) {
            for (const part of message.serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                audioStreamerRef.current?.addPlaybackChunk(part.inlineData.data);
                setState("speaking");
              }
            }
          }
          if (message.serverContent?.interrupted) {
            audioStreamerRef.current?.clearPlaybackQueue();
            setState("listening");
          }
        },
        (newState) => {
          setState(newState);
          if (newState === "connected") {
            audioStreamerRef.current?.startRecording((base64) => {
              liveSessionRef.current?.sendAudio(base64);
            }).catch((err) => {
              console.error("Mic access error:", err);
              setError("Microphone permission needed to speak with Ela.");
            });
            setState("listening");
          }
        },
        (key, value) => {
          updateMemory(key, value);
        },
        (url, topic) => {
          addOpenedWebsite(url, topic);
        }
      );

      // Connect and pass initial memory context
      await liveSessionRef.current.connect(memory);
    } catch (err) {
      setError("Failed to connect. Maybe I'm just too busy for you right now?");
      console.error(err);
    }
  };

  const stopSession = () => {
    audioStreamerRef.current?.clearPlaybackQueue();
    audioStreamerRef.current?.stopRecording();
    liveSessionRef.current?.disconnect();
    setState("disconnected");
  };

  const toggleSession = () => {
    if (state === "disconnected") {
      startSession();
    } else {
      stopSession();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-sans overflow-x-hidden flex flex-col items-center justify-center p-6 relative pb-20 md:pb-6">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center font-bold text-lg">E</div>
          <span className="text-xl font-semibold tracking-tight">Ela</span>
        </div>
        <div className="flex gap-4 items-center">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isOnline ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            {isOnline ? "Online" : "Offline"}
          </div>
          <button 
            onClick={() => setShowInfo(true)}
            className="p-2 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Info size={20} className="text-white/60" />
          </button>
          <button className="p-2 rounded-full hover:bg-white/5 transition-colors cursor-pointer">
            <Settings size={20} className="text-white/60" />
          </button>
        </div>
      </header>

      {/* Main Interaction Area with Responsive Bento Grid */}
      <main className="flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20 z-10 max-w-5xl w-full mt-24 lg:mt-0 p-2">
        
        {/* Left Card: Core Voice Interface */}
        <div className="flex flex-col items-center gap-10 min-w-[280px]">
          <div className="text-center">
            <motion.h1 
              className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400 mb-2 h-14 select-none"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              {!isOnline ? "Where'd you go?" :
               state === "disconnected" ? "Ready for me?" : 
               state === "connecting" ? "Connecting to Ela..." :
               state === "listening" ? "Listening, darling." :
               state === "speaking" ? "Listen closely..." : "Hey there."}
            </motion.h1>
            <p className="text-white/40 text-sm tracking-widest uppercase select-none mt-2">
              {!isOnline ? "You're offline, darling" : 
               state === "disconnected" ? "Tap the button to start" : "Voice active"}
            </p>
          </div>

          <Visualizer state={state} isOnline={isOnline} />

          <div className="flex flex-col items-center gap-6">
            <button
              onClick={toggleSession}
              disabled={!isOnline}
              className={`
                relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 cursor-pointer
                ${!isOnline 
                  ? "bg-white/5 border border-white/5 opacity-30 cursor-not-allowed" 
                  : state === "disconnected" 
                    ? "bg-white/5 border border-white/10 hover:bg-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]" 
                    : "bg-gradient-to-br from-pink-500 to-purple-600 shadow-[0_0_40px_rgba(236,72,153,0.6)] scale-110"}
              `}
            >
              <AnimatePresence mode="wait">
                {state === "disconnected" ? (
                  <motion.div
                    key="power"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    className="flex items-center justify-center"
                  >
                    <Power size={36} className="text-white/80" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="mic"
                    initial={{ scale: 0, rotate: 180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: -180 }}
                    className="flex items-center justify-center"
                  >
                    <Mic size={36} className="text-white" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
            
            {error && (
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-pink-400 text-xs font-medium bg-pink-400/10 px-4 py-2 rounded-full border border-pink-400/20 text-center max-w-xs"
              >
                {error}
              </motion.p>
            )}
          </div>
        </div>

        {/* Right Card: Dynamic Context Memory Notepad */}
        <div className="w-full max-w-sm flex justify-center">
          <MemoryNotepad 
            {...memory} 
            onClear={clearMemory}
          />
        </div>
      </main>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#151518] border border-white/10 p-8 rounded-3xl max-w-md w-full relative"
            >
              <button 
                onClick={() => setShowInfo(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 cursor-pointer"
              >
                <X size={20} className="text-white/40" />
              </button>
              <h2 className="text-2xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400">Meet Ela</h2>
              <p className="text-white/60 mb-6 leading-relaxed">
                I'm your witty, sassy, and slightly flirty AI companion. No typing allowed—just talk to me. I'm smart, expressive, and always have something to say.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-white/80">
                  <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400">✓</div>
                  <span>Real-time voice interaction</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-white/80">
                  <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400">✓</div>
                  <span>Witty & sassy personality</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-white/80">
                  <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400">✓</div>
                  <span>Context memory across connections</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-white/80">
                  <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400">✓</div>
                  <span>Can open websites & remember their topics</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern PWA Install Banner */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 z-40 max-w-md w-[calc(100%-3rem)] bg-[#1a1a20]/90 backdrop-blur-xl border border-pink-500/30 p-4 rounded-2xl shadow-[0_10px_40px_rgba(236,72,153,0.25)] flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center shadow-md">
                <Smartphone size={22} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">Install Ela App</span>
                <span className="text-xs text-white/60">One tap on your home screen</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="px-3.5 py-1.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Download size={14} />
                <span>Install</span>
              </button>
              <button
                onClick={() => setShowInstallBanner(false)}
                className="p-1.5 text-white/40 hover:text-white/80 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
