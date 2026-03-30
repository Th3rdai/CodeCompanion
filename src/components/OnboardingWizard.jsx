import { useState, useEffect } from "react";
import {
  MessageCircle,
  Lightbulb,
  ArrowRightLeft,
  Bug,
  Sparkles,
  FileCheck,
  WrenchIcon,
  Hammer,
  ImageIcon,
} from "lucide-react";

const STORAGE_KEY = "th3rdai_onboarding_complete";

const STEPS = [
  {
    id: "welcome",
    title: "Welcome to Code Companion",
    subtitle: "Your friendly guide to all things code",
    content: (
      <>
        <p className="text-slate-300 mb-3">
          Code Companion translates AI-generated code into honest, plain-English
          reviews — so you know what's safe to ship and what needs fixing.
        </p>
        <p className="text-slate-300 mb-3">
          Whether you're using Cursor, ChatGPT, or any AI coding tool, Code
          Companion helps you understand what your code actually does and where
          the risks are.
        </p>
        <p className="text-slate-400 text-sm">
          Everything runs on your machine. Your code and conversations never
          leave your computer.
        </p>
      </>
    ),
    icon: "👋",
  },
  {
    id: "connect",
    title: "Connect to Ollama",
    subtitle: "Your local AI engine",
    content: (
      <>
        <p className="text-slate-300 mb-3">
          Code Companion uses{" "}
          <strong className="text-indigo-300">Ollama</strong> to run AI models
          right on your machine — no API keys, no cloud, complete privacy.
        </p>
        <div className="glass rounded-lg p-3 text-xs text-slate-400 space-y-1.5">
          <p>
            <strong className="text-slate-300">Quick setup:</strong>
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Install Ollama from{" "}
              <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300">
                ollama.com
              </code>
            </li>
            <li>
              Pull a model:{" "}
              <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300">
                ollama pull llama3.2
              </code>
            </li>
            <li>
              Make sure Ollama is running, then click <strong>Settings</strong>{" "}
              up top to connect
            </li>
          </ol>
        </div>
        <div className="glass rounded-lg p-3 text-xs text-slate-400 space-y-1.5 mt-3">
          <p>
            <strong className="text-slate-300">Troubleshooting:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong>Port not responding?</strong> Make sure Ollama is running
              (check for the icon in your menu bar)
            </li>
            <li>
              <strong>No models installed?</strong> Run{" "}
              <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300">
                ollama list
              </code>{" "}
              to check, then{" "}
              <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300">
                ollama pull llama3.2
              </code>{" "}
              to download
            </li>
            <li>
              <strong>Connection refused?</strong> Check Settings to verify the
              Ollama URL matches your setup (default:{" "}
              <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-indigo-300">
                http://localhost:11434
              </code>
              )
            </li>
          </ul>
        </div>
      </>
    ),
    icon: "🔌",
  },
  {
    id: "modes",
    title: "Pick Your Mode",
    subtitle: "Eight ways to understand and improve your code",
    content: (
      <>
        <p className="text-slate-300 mb-3">
          Each mode helps with a different part of building with AI. Here are
          the highlights:
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            {
              icon: MessageCircle,
              label: "Chat",
              desc: "Ask anything about your code",
            },
            {
              icon: Lightbulb,
              label: "Explain",
              desc: "Translate code into plain English",
            },
            {
              icon: ArrowRightLeft,
              label: "Tech to Biz",
              desc: "Explain your code to anyone",
            },
            {
              icon: WrenchIcon,
              label: "Biz to Tech",
              desc: "Turn ideas into AI prompts",
            },
            { icon: Bug, label: "Safety Check", desc: "Find what could break" },
            {
              icon: FileCheck,
              label: "Review",
              desc: "Get an honest code report card",
            },
            {
              icon: Sparkles,
              label: "Clean Up",
              desc: "Make your code better",
            },
            { icon: Hammer, label: "Create", desc: "Start new projects fast" },
          ].map((m) => (
            <div
              key={m.label}
              className="glass rounded-lg p-2 flex items-center gap-2"
            >
              <m.icon className="w-4 h-4 text-indigo-400" />
              <div>
                <span className="text-slate-200 font-medium">{m.label}</span>
                <span className="text-slate-500 ml-1">{m.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </>
    ),
    icon: "🎯",
  },
  {
    id: "images",
    title: "Upload Images",
    subtitle: "Analyze screenshots, diagrams, and more",
    content: (
      <>
        <p className="text-slate-300 mb-3">
          Code Companion supports{" "}
          <strong className="text-indigo-300">image uploads</strong> with
          vision-capable AI models. Upload screenshots, error messages,
          architecture diagrams, or UI mockups for analysis.
        </p>
        <div className="glass rounded-lg p-3 text-xs text-slate-400 space-y-2">
          <p>
            <strong className="text-slate-300">Three ways to upload:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong>Drag & drop</strong> images directly into the chat area
            </li>
            <li>
              <strong>Paste screenshots</strong> with Cmd/Ctrl+V after taking
              them
            </li>
            <li>
              <strong>Click the paperclip</strong> to browse and select images
            </li>
          </ul>
        </div>
        <div className="glass rounded-lg p-3 text-xs text-slate-400 space-y-1.5 mt-3">
          <p>
            <strong className="text-slate-300">Vision models required:</strong>
          </p>
          <p>
            Install a vision model to use image features (recommended: llava)
          </p>
          <code className="block bg-slate-700/50 px-2 py-1.5 rounded text-indigo-300 mt-1.5">
            ollama pull llava
          </code>
          <p className="text-xs text-slate-500 mt-2">
            Supported formats: PNG, JPEG, GIF • Max size: 25MB (configurable in
            Settings)
          </p>
        </div>
      </>
    ),
    icon: "📸",
  },
  {
    id: "privacy",
    title: "Your Data Stays Here",
    subtitle: "Built with privacy at the core",
    content: (
      <>
        <div className="space-y-3">
          {[
            {
              icon: "🏠",
              title: "Runs locally",
              desc: "AI models run on your machine through Ollama. No cloud APIs, no external servers.",
            },
            {
              icon: "🔒",
              title: "No data collection",
              desc: "We never track, log, or transmit your code or conversations anywhere.",
            },
            {
              icon: "💾",
              title: "Local storage only",
              desc: "Conversation history is saved as JSON files on your disk. Delete them anytime.",
            },
            {
              icon: "🚫",
              title: "No API keys needed",
              desc: "No accounts, no sign-ups, no subscriptions. Just install and go.",
            },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="text-lg mt-0.5">{item.icon}</span>
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {item.title}
                </p>
                <p className="text-xs text-slate-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </>
    ),
    icon: "🛡️",
  },
];

export function isOnboardingComplete() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function resetOnboarding() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [fading, setFading] = useState(false);
  const [slideDir, setSlideDir] = useState("right");
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  function goNext() {
    if (isLast) {
      finish();
      return;
    }
    setSlideDir("right");
    setFading(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setFading(false);
    }, 200);
  }

  function goBack() {
    if (isFirst) return;
    setSlideDir("left");
    setFading(true);
    setTimeout(() => {
      setStep((s) => s - 1);
      setFading(false);
    }, 200);
  }

  function finish() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
    onComplete();
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowRight" || e.key === "Enter") goNext();
    if (e.key === "ArrowLeft") goBack();
    if (e.key === "Escape") finish();
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="dialog"
      aria-label="Welcome wizard"
      aria-modal="true"
    >
      <div className="glass-heavy rounded-2xl w-full max-w-lg neon-border overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div
          className={`p-6 transition-opacity duration-200 ${fading ? "opacity-0" : "opacity-100"}`}
        >
          {/* Step icon and title */}
          <div className="text-center mb-5">
            <div className="text-4xl mb-3">{current.icon}</div>
            <h2 className="text-xl font-bold text-slate-100 neon-text mb-1">
              {current.title}
            </h2>
            <p className="text-sm text-slate-500">{current.subtitle}</p>
          </div>

          {/* Step content */}
          <div className="mb-6 min-h-[180px]">{current.content}</div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setSlideDir(i > step ? "right" : "left");
                  setFading(true);
                  setTimeout(() => {
                    setStep(i);
                    setFading(false);
                  }, 200);
                }}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  i === step
                    ? "bg-indigo-400 w-6"
                    : i < step
                      ? "bg-indigo-600"
                      : "bg-slate-600"
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={finish}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg"
            >
              Skip tour
            </button>
            <div className="flex gap-2">
              {!isFirst && (
                <button
                  onClick={goBack}
                  className="px-4 py-2 glass hover:bg-slate-600/30 text-slate-300 rounded-lg text-sm transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={goNext}
                className="px-5 py-2 btn-neon text-white rounded-lg text-sm font-medium"
              >
                {isLast ? "Let's Go!" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
