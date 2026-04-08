
/**
 * Connection status indicator dot
 * @param {Object} props
 * @param {boolean} props.connected - Connection status
 */
export default function ConnectionDot({ connected }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2.5 h-2.5 rounded-full ${
          connected ? "bg-green-500 animate-pulse" : "bg-red-500"
        }`}
        title={connected ? "Connected to Ollama" : "Ollama disconnected"}
      />
      <span className="text-xs text-slate-400">
        {connected ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}
