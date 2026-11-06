/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { SessionState } from "../lib/live-session";

interface VisualizerProps {
  state: SessionState;
  isOnline?: boolean;
}

export const Visualizer = ({ state, isOnline = true }: VisualizerProps) => {
  const isIdle = state === "disconnected" || !isOnline;
  const isConnecting = state === "connecting" && isOnline;
  const isListening = (state === "listening" || state === "connected") && isOnline;
  const isSpeaking = state === "speaking" && isOnline;

  return (
    <div className={`relative flex items-center justify-center w-64 h-64 transition-opacity duration-1000 ${!isOnline ? "opacity-20 grayscale" : "opacity-100"}`}>
      {/* Outer Glow */}
      <motion.div
        className="absolute inset-0 rounded-full bg-pink-500/20 blur-3xl"
        animate={{
          scale: isSpeaking ? [1, 1.2, 1] : isListening ? [1, 1.1, 1] : 1,
          opacity: isIdle ? 0.1 : 0.5,
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Main Circle */}
      <motion.div
        className="relative z-10 w-48 h-48 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 shadow-[0_0_50px_rgba(236,72,153,0.5)] flex items-center justify-center overflow-hidden"
        animate={{
          scale: isConnecting ? [1, 0.9, 1] : 1,
          rotate: isConnecting ? [0, 360] : 0,
        }}
        transition={{ duration: isConnecting ? 2 : 0, repeat: Infinity, ease: "linear" }}
      >
        {/* Waveform Bars */}
        <div className="flex items-center gap-1 h-24">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1.5 bg-white/80 rounded-full"
              animate={{
                height: isSpeaking 
                  ? [10, Math.random() * 80 + 20, 10] 
                  : isListening 
                    ? [10, Math.random() * 40 + 10, 10]
                    : 10,
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                delay: i * 0.05,
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* Pulse Rings */}
      {isSpeaking && (
        <>
          <motion.div
            className="absolute z-0 w-48 h-48 rounded-full border-2 border-pink-500/50"
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.div
            className="absolute z-0 w-48 h-48 rounded-full border-2 border-purple-500/30"
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
          />
        </>
      )}
    </div>
  );
};
