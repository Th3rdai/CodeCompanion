import { useState, useEffect, useCallback } from "react";
import SplineScene from "./SplineScene";
import Spline3DError from "./Spline3DError";

/**
 * Full-screen splash / hero screen shown once per browser session.
 * Displays a Spline 3D scene in the background with the Th3rdAI branding
 * overlaid on top. Auto-dismisses after 5 seconds or on user click.
 *
 * @param {function} onDismiss - Called when splash should close
 */
export default function SplashScreen({ onDismiss }) {
  const [fading, setFading] = useState(false);
  const [sceneLoaded, setSceneLoaded] = useState(false);

  const sceneUrl = import.meta.env.VITE_SPLINE_SPLASH_SCENE || "";

  const dismiss = useCallback(() => {
    setFading(true);
    setTimeout(() => onDismiss(), 600);
  }, [onDismiss]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(dismiss, 5000);
    return () => clearTimeout(timer);
  }, [dismiss]);

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`}
      onClick={dismiss}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && dismiss()}
      aria-label="Click or press Enter to start"
    >
      {/* 3D Scene Background */}
      <div className="absolute inset-0">
        <Spline3DError>
          <SplineScene
            scene={sceneUrl}
            className="w-full h-full"
            onLoad={() => setSceneLoaded(true)}
          />
        </Spline3DError>
      </div>

      {/* Dark gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f1a] via-[#0c0f1a]/70 to-transparent" />

      {/* Centered branding content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
        {/* Logo */}
        <img
          src="/logo.svg"
          alt="Th3rdAI"
          className={`w-20 h-20 mb-6 transition-all duration-1000 ${sceneLoaded ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
        />

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold mb-3 fade-in">
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Th3rdAI
          </span>
        </h1>
        <h2 className="text-xl md:text-2xl font-medium text-slate-300 mb-2 fade-in">
          Code Companion
        </h2>
        <p className="text-sm text-slate-500 mb-10 fade-in">
          Your friendly guide to all things code
        </p>

        {/* CTA Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          className="btn-neon text-white text-sm px-8 py-3 rounded-xl font-medium tracking-wide fade-in"
        >
          Let's Go!
        </button>

        {/* Skip hint */}
        <p className="absolute bottom-8 text-xs text-slate-600 animate-pulse">
          Click anywhere to jump in...
        </p>
      </div>
    </div>
  );
}
