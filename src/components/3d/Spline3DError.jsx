import { Component } from 'react';

/**
 * Error boundary that catches Spline scene crashes and shows a
 * user-friendly fallback instead of breaking the entire app.
 *
 * Usage:
 *   <Spline3DError>
 *     <SplineScene scene={url} />
 *   </Spline3DError>
 */
export default class Spline3DError extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unknown error',
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Spline3D] Scene failed to load:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-base via-surface to-surface-light">
          <div className="glass rounded-xl p-6 text-center max-w-xs">
            <div className="text-3xl mb-3">🎭</div>
            <p className="text-sm font-medium text-slate-300 mb-1">
              3D scene couldn't load
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Check your internet connection or scene URL.
            </p>
            <button
              onClick={this.handleRetry}
              className="btn-neon text-white text-xs px-4 py-2 rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
