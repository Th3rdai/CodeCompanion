import { useState, useEffect } from "react";

// Encouraging messages that rotate during loading
const ENCOURAGING_MESSAGES = [
  "Looking for ways to make your code even better!",
  "Checking for any gotchas...",
  "Making sure everything's ship-shape!",
  "Scanning for those sneaky edge cases...",
];

/**
 * LoadingAnimation component
 * Displays a playful loading animation with rotating encouraging messages
 * Includes bouncing dots animation and accessibility features
 */
export default function LoadingAnimation({ filename }) {
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotate messages every 3.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % ENCOURAGING_MESSAGES.length);
    }, 3500);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      className="flex-1 flex items-center justify-center px-4 py-8"
      aria-label="Review in progress"
    >
      <div className="text-center space-y-4 max-w-md">
        {/* Bouncing dots animation with staggered delays */}
        <div
          className="flex items-center justify-center gap-2"
          aria-hidden="true"
        >
          <div
            className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <div
            className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <div
            className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>

        {/* Screen reader announcement - always in DOM, content updates */}
        <div role="status" aria-live="polite" className="sr-only">
          Reviewing your code. {ENCOURAGING_MESSAGES[messageIndex]}
        </div>

        {/* Main heading */}
        <h2 className="text-lg font-semibold text-slate-200">
          Reviewing your code...
        </h2>

        {/* Rotating encouraging message */}
        <p className="text-sm text-slate-300 transition-opacity duration-300">
          {ENCOURAGING_MESSAGES[messageIndex]}
        </p>

        {/* Filename display (if provided) */}
        {filename && (
          <p className="text-xs text-slate-500">
            Analyzing{" "}
            <span className="font-mono text-indigo-300">{filename}</span>
          </p>
        )}

        {/* Realistic timing expectation */}
        <p className="text-xs text-slate-500">
          This can take 30-120 seconds depending on the model and code size.
        </p>
      </div>
    </section>
  );
}
