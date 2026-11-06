/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { Brain, Sparkles, BookOpen, User, Trash2 } from "lucide-react";

interface MemoryNotepadProps {
  userName?: string;
  lastTopic?: string;
  preferences: { [key: string]: string };
  openedWebsites: Array<{ url: string; topic: string }>;
  onClear?: () => void;
}

export const MemoryNotepad = ({
  userName,
  lastTopic,
  preferences,
  openedWebsites,
  onClear,
}: MemoryNotepadProps) => {
  const hasMemories = userName || lastTopic || Object.keys(preferences).length > 0 || openedWebsites.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full max-w-sm bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-3xl p-6 relative overflow-hidden"
    >
      {/* Background radial accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
            <Brain size={18} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/90">Memory Notebook</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Ela's Active Context</p>
          </div>
        </div>
        {hasMemories && onClear && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClear}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-rose-400 border border-white/5 transition-colors cursor-pointer"
            title="Wipe Memory"
          >
            <Trash2 size={13} />
          </motion.button>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        {!hasMemories ? (
          <motion.div
            key="empty-memory"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-6 text-center text-white/30 text-xs italic flex flex-col items-center justify-center gap-2"
          >
            <Sparkles size={16} className="text-purple-400/50" />
            <span>My memory notepad is empty... tell me some gossip, babe!</span>
          </motion.div>
        ) : (
          <motion.div
            key="memory-list"
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Identity/User Name */}
            {userName && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5"
              >
                <div className="p-1 px-1.5 rounded-lg bg-pink-500/10 text-pink-400 mt-0.5">
                  <User size={13} />
                </div>
                <div>
                  <span className="text-[10px] uppercase text-white/30 font-semibold tracking-wider block">Who you are</span>
                  <span className="text-sm text-pink-300 font-medium">{userName}</span>
                </div>
              </motion.div>
            )}

            {/* Current/Last Focus Topic */}
            {lastTopic && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5"
              >
                <div className="p-1 px-1.5 rounded-lg bg-purple-500/10 text-purple-400 mt-0.5">
                  <BookOpen size={13} />
                </div>
                <div>
                  <span className="text-[10px] uppercase text-white/30 font-semibold tracking-wider block">Active Topic</span>
                  <span className="text-sm text-purple-300 font-medium">{lastTopic}</span>
                </div>
              </motion.div>
            )}

            {/* Custom Preferences */}
            {Object.keys(preferences).length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2"
              >
                <span className="text-[10px] uppercase text-white/30 font-semibold tracking-wider block">Preferences Recorded</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(preferences).map(([key, val]) => (
                    <div key={key} className="bg-white/[0.01] border border-white/5 p-2 rounded-xl">
                      <span className="text-white/40 block text-[9px] capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="text-white/80 font-medium block truncate" title={val}>{val}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Opened Websites Logs */}
            {openedWebsites.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2"
              >
                <span className="text-[10px] uppercase text-white/30 font-semibold tracking-wider block">Shared Links / Explore Histoy</span>
                <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                  {openedWebsites.slice(-3).reverse().map((site, index) => (
                    <a
                      key={index}
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[11px] bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 p-2 rounded-xl transition-all duration-300 truncate"
                    >
                      <span className="text-pink-300 hover:underline font-medium block truncate">{site.topic || site.url}</span>
                      <span className="text-[9px] text-white/30 block truncate">{site.url}</span>
                    </a>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
