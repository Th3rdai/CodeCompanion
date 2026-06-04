import { useState } from "react";
import { Shield } from "lucide-react";

const STORAGE_KEY = "th3rdai_privacy_banner_dismissed";

/**
 * Compact privacy reassurance banner shown at the bottom of the app.
 * Dismissable and remembers the user's choice via localStorage.
 * Can be re-shown from Settings.
 */
export function isPrivacyBannerDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function resetPrivacyBanner() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export default function PrivacyBanner() {
  const [dismissed, setDismissed] = useState(isPrivacyBannerDismissed);

  if (dismissed) return null;

  function handleDismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
    setDismissed(true);
  }

  return (
    <div
      className="glass border-t border-indigo-500/20 px-4 py-2.5 flex items-center gap-3 fade-in"
      role="status"
    >
      <Shield className="w-4 h-4 text-indigo-400 flex-shrink-0" />
      <p className="flex-1 text-xs text-slate-400">
        <strong className="text-slate-300">Privacy-first by default.</strong>{" "}
        Ollama runs AI on your machine — your code and conversations stay local.
        Turn on <strong className="text-slate-300">OpenRouter</strong> in
        Settings only if you want cloud models (chat then goes to their API).
        Code Companion doesn&apos;t track you, require accounts, or collect your
        data.
      </p>
      <button
        type="button"
        data-testid="privacy-banner-dismiss"
        onClick={handleDismiss}
        className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded-lg hover:bg-slate-700/50 transition-colors whitespace-nowrap"
        aria-label="Dismiss privacy banner"
      >
        Got it
      </button>
    </div>
  );
}
