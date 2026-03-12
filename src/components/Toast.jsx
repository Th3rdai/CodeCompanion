import { useEffect } from 'react';

export default function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div role="status" aria-live="polite"
      className="fixed bottom-6 right-6 z-50 glass-neon text-slate-200 text-sm px-4 py-2.5 rounded-xl shadow-lg fade-in">
      {message}
    </div>
  );
}
