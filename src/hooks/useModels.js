import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api-fetch";

/** Ollama model list, connection state, URL, persisted selection, auto-model label. */
export function useModels({ isElectron, setShowOllamaSetup, mode }) {
  const [models, setModels] = useState([]);
  const [selectedModel, _setSelectedModel] = useState(
    () => localStorage.getItem("cc-selected-model") || "",
  );
  const setSelectedModel = (m) => {
    _setSelectedModel(m);
    if (m) localStorage.setItem("cc-selected-model", m);
  };
  const [connected, setConnected] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [autoResolvedLabel, setAutoResolvedLabel] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (selectedModel !== "auto") setAutoResolvedLabel(null);
  }, [mode, selectedModel]);

  const selectedModelInfo = models.find((m) => m.name === selectedModel);
  const isVisionModel = selectedModelInfo?.supportsVision || false;

  async function refreshModels() {
    setRefreshing(true);
    try {
      const res = await apiFetch("/api/models");
      const data = await res.json();
      if (data.models) {
        setModels(data.models);
        setConnected(true);
        setOllamaUrl(data.ollamaUrl || "");
        if (data.models.length > 0 && !selectedModel) {
          const saved = localStorage.getItem("cc-selected-model");
          if (saved === "auto") setSelectedModel("auto");
          else {
            const match = saved && data.models.find((m) => m.name === saved);
            setSelectedModel(match ? match.name : data.models[0].name);
          }
        }
      } else {
        setConnected(false);
        setOllamaUrl(data.ollamaUrl || "");
        if (isElectron && models.length === 0) {
          setShowOllamaSetup(true);
        }
      }
    } catch {
      setConnected(false);
      if (isElectron && models.length === 0) {
        setShowOllamaSetup(true);
      }
    }
    setRefreshing(false);
  }

  return {
    models,
    setModels,
    connected,
    ollamaUrl,
    setOllamaUrl,
    selectedModel,
    setSelectedModel,
    autoResolvedLabel,
    setAutoResolvedLabel,
    isVisionModel,
    refreshModels,
    refreshing,
  };
}
