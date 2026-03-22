import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api-fetch';
import { Wifi, WifiOff, Download, CheckCircle, AlertCircle, Settings } from 'lucide-react';

/**
 * Ollama setup wizard component
 * Guides users through installing Ollama and pulling models
 */
export default function OllamaSetup({ onComplete }) {
  const [state, setState] = useState('not-connected'); // not-connected | installing | no-models | pulling-model | complete
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [installProgress, setInstallProgress] = useState('');
  const [pullProgress, setPullProgress] = useState({ status: '', percent: 0, completed: 0, total: 0 });
  const [error, setError] = useState(null);
  const [recommendedModel, setRecommendedModel] = useState('qwen2.5-coder:3b');

  // Check Ollama connection on mount
  useEffect(() => {
    checkConnection();
  }, []);

  // Listen for pull progress events
  useEffect(() => {
    if (window.electronAPI?.onPullProgress) {
      window.electronAPI.onPullProgress((progress) => {
        setPullProgress(progress);
      });

      return () => {
        window.electronAPI.offPullProgress?.();
      };
    }
  }, []);

  async function checkConnection() {
    try {
      if (window.electronAPI?.checkOllama) {
        // Electron mode
        const result = await window.electronAPI.checkOllama(ollamaUrl);
        if (result.running) {
          if (result.models.length === 0) {
            setState('no-models');
          } else {
            setState('complete');
            onComplete?.();
          }
        } else {
          setState('not-connected');
        }
      } else {
        // Browser mode - check via API endpoint
        const response = await apiFetch('/api/health');
        const data = await response.json();
        if (data.ollamaConnected) {
          setState('complete');
          onComplete?.();
        } else {
          setState('not-connected');
        }
      }
    } catch (err) {
      console.error('[OllamaSetup] Check failed:', err);
      setState('not-connected');
    }
  }

  async function handleInstall() {
    if (!window.electronAPI?.installOllama) {
      setError('Auto-install is only available in the desktop app');
      return;
    }

    setState('installing');
    setInstallProgress('Downloading Ollama...');
    setError(null);

    try {
      const result = await window.electronAPI.installOllama();
      if (result.success) {
        setInstallProgress('Ollama installed! Checking connection...');
        setTimeout(() => {
          checkConnection();
        }, 2000);
      } else {
        setError(result.error || 'Installation failed');
        setState('not-connected');
      }
    } catch (err) {
      setError(err.message);
      setState('not-connected');
    }
  }

  async function handlePullModel() {
    if (!window.electronAPI?.pullModel) {
      setError('Model pulling is only available in the desktop app');
      return;
    }

    setState('pulling-model');
    setPullProgress({ status: 'starting', percent: 0, completed: 0, total: 0 });
    setError(null);

    try {
      const result = await window.electronAPI.pullModel(ollamaUrl, recommendedModel);
      if (result.success) {
        setState('complete');
        onComplete?.();
      } else {
        setError(result.error || 'Model pull failed');
        setState('no-models');
      }
    } catch (err) {
      setError(err.message);
      setState('no-models');
    }
  }

  // Format bytes to GB
  function formatBytes(bytes) {
    return (bytes / 1024 / 1024 / 1024).toFixed(1);
  }

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-8 border border-slate-700">

        {/* Not Connected State */}
        {state === 'not-connected' && (
          <>
            <div className="text-center mb-6">
              <WifiOff className="w-16 h-16 mx-auto mb-4 text-red-400" />
              <h2 className="text-2xl font-bold text-white mb-2">Let's Connect to Ollama</h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Ollama is the AI engine that powers Code Companion. It runs on your computer so your code stays private.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              {window.electronAPI && (
                <button
                  onClick={handleInstall}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Install Ollama for me
                </button>
              )}

              <button
                onClick={checkConnection}
                className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
              >
                I already have it — check again
              </button>

              <button
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="w-full px-6 py-3 text-slate-400 hover:text-white text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Configure custom URL
              </button>
            </div>

            {showUrlInput && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Ollama URL
                </label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="http://localhost:11434"
                />
              </div>
            )}
          </>
        )}

        {/* Installing State */}
        {state === 'installing' && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Installing Ollama...</h2>
              <p className="text-slate-300 text-sm">{installProgress}</p>
            </div>
          </>
        )}

        {/* No Models State */}
        {state === 'no-models' && (
          <>
            <div className="text-center mb-6">
              <Wifi className="w-16 h-16 mx-auto mb-4 text-green-400" />
              <h2 className="text-2xl font-bold text-white mb-2">Ollama is running!</h2>
              <p className="text-slate-300 text-sm mb-4">
                Now let's get a model. We recommend <strong>{recommendedModel}</strong> — a smart, fast model that works great for code review.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handlePullModel}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Pull {recommendedModel}
              </button>

              <div className="text-center">
                <input
                  type="text"
                  value={recommendedModel}
                  onChange={(e) => setRecommendedModel(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Model name"
                />
                <p className="text-xs text-slate-400 mt-2">
                  Or enter a different model name from ollama.com/library
                </p>
              </div>
            </div>
          </>
        )}

        {/* Pulling Model State */}
        {state === 'pulling-model' && (
          <>
            <div className="text-center mb-6">
              <Download className="w-16 h-16 mx-auto mb-4 text-blue-400 animate-bounce" />
              <h2 className="text-2xl font-bold text-white mb-2">Downloading {recommendedModel}...</h2>
              <p className="text-slate-300 text-sm mb-4">{pullProgress.status}</p>
            </div>

            <div className="mb-6">
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ width: `${pullProgress.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-2">
                <span>{pullProgress.percent}%</span>
                {pullProgress.total > 0 && (
                  <span>
                    {formatBytes(pullProgress.completed)} GB / {formatBytes(pullProgress.total)} GB
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {/* Complete State */}
        {state === 'complete' && (
          <>
            <div className="text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
              <h2 className="text-2xl font-bold text-white mb-2">You're all set!</h2>
              <p className="text-slate-300 text-sm mb-6">
                Ollama is running and ready to help you review code.
              </p>

              <button
                onClick={() => onComplete?.()}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Start using Code Companion
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
