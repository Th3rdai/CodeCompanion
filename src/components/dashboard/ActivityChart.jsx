import { useMemo } from "react";

/**
 * Calculate 7-day activity data from conversation history
 * @param {Array} history - Conversation history with createdAt timestamps
 * @returns {Array} Array of [label, count] tuples for last 7 days
 */
function calculate7DayActivity(history) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Initialize buckets for last 7 days (0 = today, 6 = 6 days ago)
  const buckets = Array(7).fill(0);
  const labels = [];

  // Generate labels and bucket conversations
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Format label
    let label;
    if (i === 0) {
      label = "Today";
    } else if (i === 1) {
      label = "Yesterday";
    } else {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
      label = `${dayNames[date.getDay()]} ${monthDay}`;
    }
    labels.push(label);

    // Count conversations created on this date
    if (Array.isArray(history)) {
      buckets[i] = history.filter((conv) => {
        if (!conv.createdAt) return false;
        const convDate = new Date(conv.createdAt);
        const convDay = new Date(
          convDate.getFullYear(),
          convDate.getMonth(),
          convDate.getDate()
        );
        return convDay.getTime() === date.getTime();
      }).length;
    }
  }

  // Return as [label, count] tuples in chronological order (oldest first)
  return labels.map((label, i) => [label, buckets[i]]).reverse();
}

/**
 * ActivityChart - 7-day conversation activity visualization
 * Shows daily conversation counts for the last 7 days as a bar chart
 */
export default function ActivityChart({ history }) {
  const activityData = useMemo(
    () => calculate7DayActivity(history),
    [history]
  );

  if (!activityData || activityData.length === 0) {
    return null;
  }

  const max = Math.max(...activityData.map(([, count]) => count), 1);

  return (
    <div className="space-y-3" role="list" aria-label="7-day activity chart">
      {activityData.map(([label, count]) => {
        const percentage = Math.max((count / max) * 100, 2);

        return (
          <div key={label} className="space-y-1" role="listitem">
            {/* Label and Value Row */}
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-medium w-24">{label}</span>
              <span className="ml-2 text-slate-400">
                {count} {count === 1 ? "conversation" : "conversations"}
              </span>
            </div>

            {/* Progress Bar */}
            <div
              className="h-2.5 rounded-full bg-slate-800 overflow-hidden"
              role="progressbar"
              aria-valuenow={count}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-label={`${label}: ${count} conversations`}
            >
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
