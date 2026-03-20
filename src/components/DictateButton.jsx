import { useState, useRef, useCallback } from 'react';

/**
 * DictateButton — a mic button that uses the Web Speech API
 * to transcribe speech and append it to a text field.
 *
 * Props:
 *   onResult(text)  — called with transcribed text to append
 *   disabled        — disables the button
 *   className       — optional extra classes
 */
export default function DictateButton({ onResult, disabled = false, className = '' }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const toggle = useCallback(async () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    setError(null);

    // Warm up microphone permission before starting speech recognition.
    // This ensures the OS permission prompt appears before SpeechRecognition
    // tries to access the mic (which fails silently on some platforms).
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release the mic immediately — we just needed the permission grant
      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Check System Settings → Privacy & Security → Microphone.');
        console.warn('Microphone permission denied:', err);
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No microphone found. Connect an audio input device.');
        console.warn('No microphone hardware:', err);
      } else {
        setError('Microphone unavailable.');
        console.warn('getUserMedia error:', err);
      }
      return;
    }

    // In Electron, also try the native permission API if available
    if (window.electronAPI?.requestMicrophoneAccess) {
      try {
        const status = await window.electronAPI.requestMicrophoneAccess();
        if (status === 'denied') {
          setError('Microphone access denied. Re-enable in System Settings → Privacy & Security → Microphone, then relaunch.');
          return;
        }
      } catch {
        // Non-critical — getUserMedia succeeded, so we can proceed
      }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      // Gather all new final results
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) {
        onResult(transcript.trim());
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied.');
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [listening, onResult]);

  const title = !supported
    ? 'Voice dictation requires Chrome or Edge'
    : error
      ? error
      : listening ? 'Stop dictation' : 'Start dictation';

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || !supported}
        title={title}
        className={`flex items-center justify-center rounded-lg transition-all duration-200 ${
          error
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            : listening
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
              : 'bg-slate-700/40 text-slate-400 border border-slate-600/30 hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/30'
        } disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        style={{ width: '36px', height: '36px', fontSize: '16px' }}
      >
        {listening ? '⏹' : '🎤'}
      </button>
      {error && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 rounded-lg bg-amber-900/90 border border-amber-500/40 text-amber-200 text-xs text-center shadow-lg z-50 pointer-events-none">
          {error}
        </div>
      )}
    </div>
  );
}
