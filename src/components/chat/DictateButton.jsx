import { useState, useRef, useCallback, useEffect } from "react";
import { apiFetch } from "../../lib/api-fetch";

/**
 * DictateButton — Web Speech API with optional server fallback (Groq Whisper)
 * when Google's speech service is unreachable (VPN / firewall).
 *
 * Props:
 *   onResult(text)  — called with transcribed text to append
 *   disabled        — disables the button
 *   className       — optional extra classes
 *   dictateGroqConfigured — optional: from GET /api/config; skips a config fetch when known
 */
export default function DictateButton({
  onResult,
  disabled = false,
  className = "",
  dictateGroqConfigured: dictateGroqConfiguredProp,
}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const [offlineHint, setOfflineHint] = useState(null);
  const recognitionRef = useRef(null);
  const modeRef = useRef("idle"); // idle | speech | offline_record
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const offlineChunksRef = useRef([]);
  const dictateCacheRef = useRef(null);
  /** When true, `onend` must not clear listening — we are switching to offline recording. */
  const speechHandoffRef = useRef(false);

  useEffect(() => {
    if (dictateGroqConfiguredProp === true) dictateCacheRef.current = true;
    else if (dictateGroqConfiguredProp === false)
      dictateCacheRef.current = false;
  }, [dictateGroqConfiguredProp]);

  const speechSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const mediaSupported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

  const supported = speechSupported || mediaSupported;

  const pickRecorderMime = () => {
    const c = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    for (const t of c) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  };

  const ensureFallbackAvailable = useCallback(async () => {
    if (dictateGroqConfiguredProp === true) return true;
    if (dictateGroqConfiguredProp === false) return false;
    if (dictateCacheRef.current === true) return true;
    if (dictateCacheRef.current === false) return false;
    try {
      const r = await apiFetch("/api/config");
      const d = await r.json();
      const ok = !!d.dictateGroqConfigured;
      dictateCacheRef.current = ok;
      return ok;
    } catch {
      return false;
    }
  }, [dictateGroqConfiguredProp]);

  const stopMediaStream = useCallback(() => {
    const s = mediaStreamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const finalizeOfflineRecording = useCallback(async () => {
    const rec = mediaRecorderRef.current;
    const mimeType = rec?.mimeType || pickRecorderMime() || "audio/webm";
    mediaRecorderRef.current = null;
    if (rec && rec.state !== "inactive") {
      await new Promise((resolve) => {
        rec.onstop = resolve;
        rec.stop();
      });
    }
    stopMediaStream();

    const chunks = offlineChunksRef.current;
    offlineChunksRef.current = [];
    if (!chunks.length) {
      setError("No audio captured. Try again and speak closer to the mic.");
      setListening(false);
      modeRef.current = "idle";
      setOfflineHint(null);
      return;
    }
    const blob = new Blob(chunks, { type: mimeType });
    const base64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || "");
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = () => reject(new Error("Failed to read audio blob"));
      r.readAsDataURL(blob);
    });

    try {
      const res = await apiFetch("/api/dictate-transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64, mimeType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503 && data.code === "DICTATE_NOT_CONFIGURED") {
          setError(
            data.error ||
              "Add a Groq API key in Settings → General (voice dictation) or set GROQ_API_KEY in .env.",
          );
        } else {
          setError(data.error || `Transcription failed (${res.status})`);
        }
        setListening(false);
        modeRef.current = "idle";
        setOfflineHint(null);
        return;
      }
      if (data.text && String(data.text).trim()) {
        onResult(String(data.text).trim());
      }
    } catch (e) {
      setError(e.message || "Transcription request failed");
    }
    setListening(false);
    modeRef.current = "idle";
    setOfflineHint(null);
  }, [onResult, stopMediaStream]);

  const startOfflineRecording = useCallback(async () => {
    const ok = await ensureFallbackAvailable();
    if (!ok) {
      setError(
        "Web Speech cannot reach Google (network). Add a free Groq API key in Settings → General — section “Voice dictation (offline)” — then Save.",
      );
      setListening(false);
      modeRef.current = "idle";
      return;
    }
    if (!mediaSupported) {
      setError("Recording not supported in this environment.");
      setListening(false);
      modeRef.current = "idle";
      return;
    }

    offlineChunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;
    const mimeType = pickRecorderMime();
    const rec = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    mediaRecorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) offlineChunksRef.current.push(e.data);
    };
    rec.start(250);
    modeRef.current = "offline_record";
    setListening(true);
    setOfflineHint("Recording… tap mic again to transcribe (local, via Groq)");
    setError(null);
  }, [ensureFallbackAvailable, mediaSupported]);

  const toggle = useCallback(async () => {
    if (listening) {
      if (modeRef.current === "offline_record") {
        await finalizeOfflineRecording();
        return;
      }
      recognitionRef.current?.stop();
      return;
    }

    setError(null);
    setOfflineHint(null);

    if (window.electronAPI?.getMicrophoneAccessStatus) {
      try {
        let micStatus = await window.electronAPI.getMicrophoneAccessStatus();
        if (
          micStatus !== "granted" &&
          window.electronAPI.requestMicrophoneAccess
        ) {
          micStatus = await window.electronAPI.requestMicrophoneAccess();
        }
        if (micStatus !== "granted") {
          if (window.electronAPI.openMicrophoneSettings) {
            await window.electronAPI.openMicrophoneSettings();
          }
          setError(
            micStatus === "denied" || micStatus === "restricted"
              ? "Microphone access denied. System Settings → Privacy & Security → Microphone — enable Code Companion, then relaunch the app."
              : "Microphone permission required. Allow access when prompted, or enable Code Companion under Privacy & Security → Microphone.",
          );
          return;
        }
      } catch {
        /* fall through to getUserMedia probe */
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        if (window.electronAPI?.openMicrophoneSettings) {
          await window.electronAPI.openMicrophoneSettings();
        }
        setError(
          "Microphone access denied. Check System Settings → Privacy & Security → Microphone for Code Companion, then relaunch the app. If it is already enabled, install the latest app update (older builds lacked the microphone entitlement).",
        );
        console.warn("Microphone permission denied:", err);
        return;
      } else if (
        err.name === "NotFoundError" ||
        err.name === "DevicesNotFoundError"
      ) {
        setError("No microphone found. Connect an audio input device.");
        console.warn("No microphone hardware:", err);
        return;
      } else {
        setError("Microphone unavailable.");
        console.warn("getUserMedia error:", err);
        return;
      }
    }

    if (!speechSupported) {
      await startOfflineRecording();
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      modeRef.current = "speech";
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) {
        onResult(transcript.trim());
      }
    };

    recognition.onerror = async (event) => {
      console.warn("Speech recognition error:", event.error);
      recognitionRef.current = null;

      if (event.error === "not-allowed") {
        setListening(false);
        modeRef.current = "idle";
        setError(
          "Speech recognition blocked (not-allowed). If the OS already allows the mic, try relaunching the app or check that no other app has exclusive mic access.",
        );
        return;
      }
      if (event.error === "network" || event.error === "service-not-allowed") {
        const fallback = await ensureFallbackAvailable();
        if (fallback && mediaSupported) {
          speechHandoffRef.current = true;
          setListening(false);
          modeRef.current = "idle";
          try {
            await startOfflineRecording();
          } finally {
            speechHandoffRef.current = false;
          }
          return;
        }
        setListening(false);
        modeRef.current = "idle";
        setError(
          "Speech service unreachable (network). Web Speech uses Google’s servers. Add a Groq API key under Settings → General (voice dictation) for offline transcription, or allow the connection through your VPN/firewall.",
        );
        return;
      }
      setListening(false);
      modeRef.current = "idle";
      setError(`Speech error: ${event.error}`);
    };

    recognition.onend = () => {
      if (speechHandoffRef.current) {
        recognitionRef.current = null;
        return;
      }
      if (modeRef.current === "speech") {
        setListening(false);
        modeRef.current = "idle";
      }
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.warn("SpeechRecognition.start failed:", e);
      if (mediaSupported && (await ensureFallbackAvailable())) {
        await startOfflineRecording();
      } else {
        setError("Could not start speech recognition.");
      }
    }
  }, [
    listening,
    onResult,
    speechSupported,
    mediaSupported,
    ensureFallbackAvailable,
    startOfflineRecording,
    finalizeOfflineRecording,
  ]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      mediaRecorderRef.current = null;
      stopMediaStream();
    };
  }, [stopMediaStream]);

  const title = !supported
    ? "Voice dictation requires a browser with Web Speech or MediaRecorder"
    : error
      ? error
      : offlineHint || (listening ? "Stop dictation" : "Start dictation");

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || !supported}
        title={title}
        className={`flex items-center justify-center rounded-lg transition-all duration-200 ${
          error
            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
            : listening
              ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
              : "bg-slate-700/40 text-slate-400 border border-slate-600/30 hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/30"
        } disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        style={{ width: "36px", height: "36px", fontSize: "16px" }}
      >
        {listening ? "⏹" : "🎤"}
      </button>
      {(error || offlineHint) && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 max-w-[min(18rem,calc(100vw-2rem))] p-2 rounded-lg bg-amber-900/90 border border-amber-500/40 text-amber-200 text-xs text-center shadow-lg z-50 pointer-events-none">
          {error || offlineHint}
        </div>
      )}
    </div>
  );
}
