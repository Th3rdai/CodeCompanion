import { useState, useEffect } from "react";
import { Shield, Eye, Lock, Database, AlertTriangle } from "lucide-react";

/**
 * ImagePrivacyWarning Modal
 * Shows important privacy and security information on first image upload
 * Triggered by Phase 2 upload logic when user uploads first image
 */
export default function ImagePrivacyWarning({ onClose, onAccept }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // ESC key handler
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleAccept = () => {
    if (dontShowAgain) {
      localStorage.setItem("cc-image-privacy-accepted", "true");
    }
    onAccept?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="glass-heavy rounded-2xl w-full max-w-lg p-6 neon-border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Image Upload Privacy Notice"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-yellow-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-100">
            Image Upload Privacy Notice
          </h3>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-6 text-sm text-slate-300">
          <p className="text-slate-200">
            Before uploading images, please be aware of the following privacy
            and security considerations:
          </p>

          <div className="space-y-3">
            {/* Sensitive Information */}
            <div className="flex gap-3">
              <div className="shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="font-medium text-slate-200">
                  Don't upload sensitive information
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Avoid images containing API keys, passwords, credit card
                  numbers, or other confidential data.
                </p>
              </div>
            </div>

            {/* EXIF Metadata */}
            <div className="flex gap-3">
              <div className="shrink-0 mt-0.5">
                <Lock className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="font-medium text-slate-200">
                  EXIF metadata is automatically stripped
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  GPS coordinates, timestamps, and camera information are
                  removed for your privacy.
                </p>
              </div>
            </div>

            {/* AI Reading Images */}
            <div className="flex gap-3">
              <div className="shrink-0 mt-0.5">
                <Eye className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-slate-200">
                  AI can read text in images
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Vision models can extract text from screenshots. Be aware of
                  prompt injection risks.
                </p>
              </div>
            </div>

            {/* Storage */}
            <div className="flex gap-3">
              <div className="shrink-0 mt-0.5">
                <Database className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-slate-200">
                  Images are stored locally
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Images are saved in your conversation history files. They
                  remain on your machine.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
            <p className="text-xs text-indigo-200">
              <strong>Tip:</strong> Images are processed locally and sent to
              your Ollama instance. No data is sent to external servers.
            </p>
          </div>
        </div>

        {/* Don't show again checkbox */}
        <label className="flex items-center gap-2 mb-6 cursor-pointer group">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
          />
          <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
            Don't show this again
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 glass hover:bg-slate-600/30 text-slate-300 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 btn-neon text-white rounded-lg text-sm font-medium"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
