import SplineScene from './SplineScene';
import Spline3DError from './Spline3DError';

/**
 * Enhanced empty state with optional 3D Spline scene.
 * Shows when chat has no messages yet.
 *
 * Layout:
 * - WITH scene URL:  Left side = 3D scene, Right side = text content
 * - WITHOUT scene URL: Centered text with gradient background (original layout)
 *
 * Width: outer wrapper uses max-w-6xl (content rail) — see design-system/DESIGN-STANDARDS.md §6.2.
 * - Mobile: Stacks vertically (scene on top, text below)
 *
 * Preserves all original functionality: mode icon, description,
 * model badge, "Try:" suggestion cards.
 */
export default function EmptyStateScene({
  mode,
  currentMode,
  connected,
  selectedModel,
  onSettingsClick,
}) {
  const sceneUrl = import.meta.env.VITE_SPLINE_EMPTY_STATE_SCENE || '';
  const hasScene = Boolean(sceneUrl);

  // "Try:" suggestion cards based on current mode
  const suggestions = {
    chat: [
      'Explain "microservices" like I\'m five',
      'Help me get ready for sprint planning',
    ],
    explain: [
      'Paste a function — I\'ll walk you through it',
      'Drop an API endpoint and I\'ll break it down',
    ],
    bugs: [
      'Paste your team\'s code — let\'s check it together',
      'Let\'s do a quick security check before launch',
    ],
    refactor: [
      'Got messy code? Let me help tidy it up',
      'Paste something old — I\'ll modernize it for you',
    ],
    'translate-tech': [
      'Paste a PR and I\'ll make it stakeholder-friendly',
      'Drop a technical spec — I\'ll translate it to plain English',
    ],
    'translate-biz': [
      'Describe a feature idea — I\'ll draft the specs',
      'Tell me what users want — I\'ll write the tech requirements',
    ],
  };

  const trySuggestions = suggestions[mode] || suggestions.chat;

  return (
    <div className="h-full flex items-center justify-center">
      <div
        className={`flex items-center gap-6 w-full max-w-6xl px-6 ${
          hasScene
            ? 'flex-col md:flex-row'
            : 'flex-col'
        }`}
      >
        {/* 3D Scene (left side / top on mobile) */}
        {hasScene && (
          <div className="w-full md:w-1/2 h-48 md:h-80 rounded-2xl overflow-hidden glass neon-border fade-in">
            <Spline3DError>
              <SplineScene scene={sceneUrl} className="w-full h-full" />
            </Spline3DError>
          </div>
        )}

        {/* Text content (right side / bottom on mobile) */}
        <div
          className={`text-center fade-in ${
            hasScene ? 'w-full md:w-1/2 md:text-left' : 'max-w-md'
          }`}
        >
          {/* Mode icon */}
          <div className={`text-5xl mb-4 ${hasScene ? 'md:text-4xl' : ''}`}>
            {currentMode?.icon}
          </div>

          {/* Mode title & description */}
          <h2 className="text-xl font-bold text-slate-200 mb-2 neon-text">
            {currentMode?.label}
          </h2>
          <p className="text-slate-400 mb-4">{currentMode?.desc}</p>

          {/* Model status badge */}
          {connected && selectedModel && (
            <div
              className={`inline-flex items-center gap-2 glass rounded-lg px-3 py-1.5 text-xs text-slate-400 mb-6`}
            >
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              Using{' '}
              <strong className="text-indigo-400">
                {selectedModel.split(':')[0]}
              </strong>
            </div>
          )}

          {/* Connect button (offline) */}
          {!connected && (
            <button
              onClick={onSettingsClick}
              className="mb-6 btn-neon text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Connect to Ollama
            </button>
          )}

          {/* "Try:" suggestion cards */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 gap-2 text-left text-xs ${
              hasScene ? 'md:grid-cols-1 lg:grid-cols-2' : ''
            }`}
          >
            {trySuggestions.map((suggestion, i) => (
              <div key={i} className="glass rounded-lg p-3">
                <span className="text-indigo-400">Try:</span> {suggestion}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
