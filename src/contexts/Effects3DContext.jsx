import { createContext, useContext, useState, useEffect } from 'react';

const Effects3DContext = createContext({ enabled: true, setEnabled: () => {} });

const STORAGE_KEY = 'th3rdai_3d_effects';

export function Effects3DProvider({ children }) {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch {}
  }, [enabled]);

  return (
    <Effects3DContext.Provider value={{ enabled, setEnabled }}>
      {children}
    </Effects3DContext.Provider>
  );
}

export function use3DEffects() {
  return useContext(Effects3DContext);
}
