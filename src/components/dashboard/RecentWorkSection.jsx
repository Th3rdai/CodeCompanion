import { useState, useEffect } from "react";
import { Clock, ArrowRight } from "lucide-react";

/**
 * Skeleton screen shown while loading conversations (>300ms)
 */
function RecentWorkSkeleton() {
  return (
    <div className="glass p-6 rounded-xl animate-pulse">
      <div className="h-6 w-32 bg-slate-700 rounded mb-4" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass-neon p-4 rounded-lg mb-3">
          <div className="h-5 w-48 bg-slate-700 rounded mb-2" />
          <div className="h-4 w-24 bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state when no conversations exist
 */
function EmptyState({ onStartChat }) {
  return (
    <div className="glass p-8 rounded-xl text-center">
      <div className="max-w-md mx-auto space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-indigo-500/10 flex items-center justify-center">
          <Clock className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">No recent activity</h3>
        <p className="text-sm text-slate-400">
          Start chatting to see your recent conversations here
        </p>
        <button
          onClick={onStartChat}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          Start a Conversation
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Recent Work Section - Shows last 3 conversations
 * Phase 2 Implementation
 */
export default function RecentWorkSection({
  conversations,
  onResume,
  onStartChat,
  loading,
}) {
  const [showSkeleton, setShowSkeleton] = useState(false);

  // Show skeleton if loading takes >300ms
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowSkeleton(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowSkeleton(false);
    }
  }, [loading]);

  // Show skeleton during loading
  if (loading && showSkeleton) {
    return <RecentWorkSkeleton />;
  }

  // Show empty state if no conversations
  if (!conversations || conversations.length === 0) {
    return <EmptyState onStartChat={onStartChat} />;
  }

  // Get last 3 conversations sorted by most recent
  const recentConversations = conversations
    .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0))
    .slice(0, 3);

  /**
   * Format timestamp as relative time
   */
  function formatRelativeTime(timestamp) {
    if (!timestamp) return "Just now";

    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  /**
   * Get mode emoji/label from mode ID
   */
  function getModeLabel(modeId) {
    const modeMap = {
      chat: "💬 Chat",
      review: "📝 Review",
      pentest: "🛡️ Security",
      build: "🏗️ Build",
      create: "🛠️ Create",
      experiment: "🧪 Experiment",
      validate: "✅ Validate",
      prompting: "🎯 Prompting",
      skillz: "⚡ Skillz",
      agentic: "🤖 Agentic",
      planner: "📋 Planner",
    };
    return modeMap[modeId] || modeId;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Recent Work</h2>
        <span className="text-sm text-slate-400">
          Last {recentConversations.length} conversations
        </span>
      </div>

      {/* Conversation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recentConversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onResume(conv.id, conv.mode)}
            className="glass p-4 rounded-xl text-left hover:border-indigo-500/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/20 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0f1a] min-h-[120px]"
            aria-label={`Resume ${conv.title || "conversation"} from ${formatRelativeTime(conv.lastActive)}`}
          >
            <div className="space-y-2">
              {/* Mode Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-indigo-400 font-medium">
                  {getModeLabel(conv.mode)}
                </span>
                <span className="text-xs text-slate-500">
                  {formatRelativeTime(conv.lastActive)}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-sm font-semibold text-white line-clamp-2">
                {conv.title || "Untitled conversation"}
              </h3>

              {/* Message Count */}
              {conv.messages && conv.messages.length > 0 && (
                <p className="text-xs text-slate-400">
                  {conv.messages.length} message
                  {conv.messages.length !== 1 ? "s" : ""}
                </p>
              )}

              {/* Resume Arrow */}
              <div className="flex items-center gap-1 text-xs text-indigo-400 font-medium mt-2">
                Resume
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
