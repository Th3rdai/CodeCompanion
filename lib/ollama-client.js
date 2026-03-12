async function listModels(ollamaUrl) {
  const url = `${ollamaUrl}/api/tags`;
  const response = await fetch(url);
  const data = await response.json();
  
  return (data.models || []).map(m => ({
    name: m.name,
    size: Math.round(m.size / 1024 / 1024 / 1024 * 10) / 10,
    modified: m.modified_at,
    family: m.details?.family || 'unknown',
    paramSize: m.details?.parameter_size || ''
  }));
}

async function checkConnection(ollamaUrl) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);

    const data = await response.json();
    const modelCount = (data.models || []).length;
    return { connected: true, modelCount };
  } catch (err) {
    return { connected: false, modelCount: 0 };
  }
}

function chatStream(ollamaUrl, model, messages) {
  const url = `${ollamaUrl}/api/chat`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true
    })
  });
}

async function chatComplete(ollamaUrl, model, messages, timeoutMs = 120000) {
  const url = `${ollamaUrl}/api/chat`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

module.exports = {
  listModels,
  checkConnection,
  chatStream,
  chatComplete
};
