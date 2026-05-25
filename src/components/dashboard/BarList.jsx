/**
 * BarList - Accessible horizontal bar chart component
 * Displays data as labeled bars with values, sorted by count descending
 */
export default function BarList({ items, ariaLabel = "Data visualization" }) {
  if (!items || items.length === 0) {
    return null;
  }

  const max = Math.max(...items.map(([, count]) => count), 1);

  return (
    <div className="space-y-2" role="list" aria-label={ariaLabel}>
      {items.map(([label, count]) => {
        const percentage = Math.max((count / max) * 100, 4);

        return (
          <div key={label} className="space-y-1" role="listitem">
            {/* Label and Value Row */}
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="truncate" title={label}>
                {label}
              </span>
              <span className="ml-2 font-medium">{count}</span>
            </div>

            {/* Progress Bar */}
            <div
              className="h-2 rounded bg-slate-800 overflow-hidden"
              role="progressbar"
              aria-valuenow={count}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-label={`${label}: ${count}`}
            >
              <div
                className="h-full bg-indigo-500/80 transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
