import SplineScene from './SplineScene';
import Spline3DError from './Spline3DError';
import { use3DEffects } from '../../contexts/Effects3DContext';

/**
 * Ambient 3D background that renders behind the app header.
 * Sits absolutely positioned behind the glass-heavy header,
 * visible through the translucent glass effect.
 *
 * Designed to be subtle and non-distracting — users interact
 * with header buttons on top of this.
 */
export default function HeaderScene() {
  const { enabled } = use3DEffects();
  const sceneUrl = import.meta.env.VITE_SPLINE_HEADER_SCENE || '';

  // Don't render anything if disabled or no scene URL is set
  if (!enabled || !sceneUrl) return null;

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <Spline3DError>
        <SplineScene
          scene={sceneUrl}
          className="w-full h-full opacity-40"
        />
      </Spline3DError>
    </div>
  );
}
