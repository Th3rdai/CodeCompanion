import CollapsibleSection from "./CollapsibleSection";

/**
 * QuickStatsGrid - Summary statistics display
 * Shows total conversations, active, archived, and message counts
 */
export default function QuickStatsGrid({ analytics }) {
  let body;

  if (!analytics?.totals) {
    body = (
      <div className="glass rounded-xl p-6 text-center">
        <p className="text-sm text-slate-400">
          No analytics data available yet
        </p>
      </div>
    );
  } else {
    const { totals } = analytics;

    const stats = [
      {
        label: "Conversations",
        value: totals.conversations ?? 0,
        color: "text-slate-100",
      },
      {
        label: "Active",
        value: totals.active ?? 0,
        color: "text-indigo-300",
      },
      {
        label: "Archived",
        value: totals.archived ?? 0,
        color: "text-slate-300",
      },
      {
        label: "Messages",
        value: totals.messages ?? 0,
        color: "text-slate-100",
      },
    ];

    body = (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="glass p-4 rounded-xl text-center hover:border-indigo-500/30 transition-colors duration-200"
          >
            <div className="text-xs text-slate-400 mb-2">{stat.label}</div>
            <div className={`text-2xl font-bold ${stat.color}`}>
              {stat.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <CollapsibleSection
      title="Quick Stats"
      storageKey="cc.dashboard.quickStats"
    >
      {body}
    </CollapsibleSection>
  );
}
