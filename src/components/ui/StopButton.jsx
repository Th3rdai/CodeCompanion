/**
 * Shared red Stop button — matches the existing chat Stop button styling.
 * Used by ReviewPanel, SecurityPanel, ValidatePanel, and BaseBuilderPanel.
 */
export default function StopButton({ onClick, label = 'Stop', className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 font-medium bg-red-600/90 hover:bg-red-500 text-white border border-red-500/50 shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 ${className}`}
      aria-label="Stop generation"
    >
      {label}
    </button>
  );
}
