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
  const recognitionRef = useRef(null);

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const toggle = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
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
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [listening, onResult]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={listening ? 'Stop dictation' : 'Start dictation'}
      className={`flex items-center justify-center rounded-lg transition-all duration-200 ${
        listening
          ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
          : 'bg-slate-700/40 text-slate-400 border border-slate-600/30 hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/30'
      } disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      style={{ width: '36px', height: '36px', fontSize: '16px' }}
    >
      {listening ? '⏹' : '🎤'}
    </button>
  );
}
