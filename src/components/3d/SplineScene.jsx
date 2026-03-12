import { lazy, Suspense } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

/**
 * Loading spinner that matches the Th3rdAI brand.
 * Shows while a Spline scene is downloading/initializing.
 */
function SceneLoader() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-base via-surface to-surface-light">
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-400 spin" />
        </div>
        <span className="text-xs text-slate-500">Loading 3D scene...</span>
      </div>
    </div>
  );
}

/**
 * Gradient fallback shown when no scene URL is configured
 * or when reduced-motion is preferred.
 */
function GradientFallback({ className = '' }) {
  return (
    <div className={`w-full h-full ${className}`}>
      <div className="w-full h-full bg-gradient-to-br from-base via-surface to-surface-light relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-blue-500/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-purple-500/6 rounded-full blur-3xl" />
      </div>
    </div>
  );
}

/**
 * Core Spline scene wrapper with lazy loading, Suspense, and graceful fallbacks.
 *
 * @param {string}   scene     - Spline scene URL (https://prod.spline.design/...)
 * @param {string}   className - Additional CSS classes for sizing/positioning
 * @param {function} onLoad    - Callback fired when scene finishes loading
 */
export default function SplineScene({ scene, className = '', onLoad }) {
  // Check for reduced-motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // No scene URL configured — show gradient fallback
  if (!scene) {
    return <GradientFallback className={className} />;
  }

  // User prefers reduced motion — skip 3D, show static fallback
  if (prefersReducedMotion) {
    return <GradientFallback className={className} />;
  }

  return (
    <Suspense fallback={<SceneLoader />}>
      <Spline
        scene={scene}
        className={className}
        onLoad={onLoad}
      />
    </Suspense>
  );
}

export { GradientFallback, SceneLoader };
