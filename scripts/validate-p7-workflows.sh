#!/usr/bin/env bash
# Phase 7 strict checks: warm Ollama, then chat / review / diagram SSE via the app,
# plus MCP tools (>= baseline) and 12 mode prompts. Requires a running server and Ollama.
#
# Env:
#   VALIDATE_BASE_URL   App base (default http://127.0.0.1:4173). Use https://127.0.0.1:PORT with TLS.
#   OLLAMA_URL          Ollama API (default http://127.0.0.1:11434)
#   VALIDATE_P7_MODEL   Force a model name; otherwise pick a small local model from /api/models.
#   VALIDATE_P7_WARM_SEC   Max seconds for cold-load warm (default 240)
#   VALIDATE_P7_CHAT_SEC   Max seconds per SSE curl (default 300)
#   VALIDATE_P7_MIN_MCP_TOOLS  Minimum tools/list count (default 11)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

BASE="${VALIDATE_BASE_URL:-http://127.0.0.1:4173}"
OLLAMA="${OLLAMA_URL:-http://127.0.0.1:11434}"
WARM_SEC="${VALIDATE_P7_WARM_SEC:-240}"
SSE_SEC="${VALIDATE_P7_CHAT_SEC:-300}"
MIN_MCP="${VALIDATE_P7_MIN_MCP_TOOLS:-11}"

if [[ "${BASE}" == https://* ]]; then
  CURLF=(curl -skf)
  CURLN=(curl -skN)
else
  CURLF=(curl -sf)
  CURLN=(curl -sN)
fi

need_sse_data() {
  local file="$1"
  local label="$2"
  if grep -q 'data:' "${file}" 2>/dev/null; then
    echo "${label}: OK (SSE data: lines)"
    return 0
  fi
  echo "${label}: FAIL — no SSE data: lines in response ($(wc -c <"${file}" | tr -d ' ') bytes)" >&2
  head -c 400 "${file}" >&2 || true
  return 1
}

need_review_response() {
  local file="$1"
  if grep -q 'data:' "${file}" 2>/dev/null; then
    echo "Review: OK (SSE)"
    return 0
  fi
  if grep -qE '"overallGrade"|"grades"|"findings"|"report-card"' "${file}" 2>/dev/null; then
    echo "Review: OK (JSON report card)"
    return 0
  fi
  echo "Review: FAIL — neither SSE nor report-card JSON ($(wc -c <"${file}" | tr -d ' ') bytes)" >&2
  head -c 500 "${file}" >&2 || true
  return 1
}

pick_model() {
  if [[ -n "${VALIDATE_P7_MODEL:-}" ]]; then
    echo "${VALIDATE_P7_MODEL}"
    return
  fi
  local json
  json="$("${CURLF[@]}" --max-time 15 "${BASE}/api/models" || echo '{}')"
  echo "${json}" | node -e '
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => {
      let j = {};
      try {
        j = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {}
      const names = (j.models || []).map((m) => m.name).filter(Boolean);
      const prefer = [
        "llama3.2:latest",
        "qwen2.5:7b",
        "qwen2.5:latest",
        "gemma3:12b",
        "gemma4:latest",
        "qwen3:latest",
        "qwen2.5:32b",
      ];
      for (const p of prefer) {
        if (names.includes(p)) {
          console.log(p);
          process.exit(0);
        }
      }
      const bad = /embed|nomic|embedding/i;
      const first = names.find((n) => !bad.test(n));
      console.log(first || "llama3.2:latest");
    });
  '
}

warm_ollama() {
  local model="$1"
  echo "P7: warming Ollama model ${model} (stream=false, max ${WARM_SEC}s)..."
  "${CURLF[@]}" --max-time "${WARM_SEC}" "${OLLAMA}/api/generate" \
    -H 'Content-Type: application/json' \
    -d "{\"model\":\"${model}\",\"prompt\":\"OK\",\"stream\":false,\"options\":{\"num_predict\":3}}" \
    >/dev/null
  echo "P7: warm complete."
}

run_sse() {
  local label="$1"
  local path="$2"
  local body="$3"
  local tmp
  tmp="$(mktemp)"
  set +e
  "${CURLN[@]}" --max-time "${SSE_SEC}" -X POST "${BASE}${path}" \
    -H 'Content-Type: application/json' \
    -d "${body}" -o "${tmp}"
  local code=$?
  set -e
  if [[ "${code}" -eq 28 ]]; then
    echo "${label}: FAIL — curl timeout after ${SSE_SEC}s" >&2
    rm -f "${tmp}"
    return 1
  fi
  need_sse_data "${tmp}" "${label}"
  rm -f "${tmp}"
}

run_review() {
  local body="$1"
  local tmp
  tmp="$(mktemp)"
  set +e
  "${CURLN[@]}" --max-time "${SSE_SEC}" -X POST "${BASE}/api/review" \
    -H 'Content-Type: application/json' \
    -d "${body}" -o "${tmp}"
  local code=$?
  set -e
  if [[ "${code}" -eq 28 ]]; then
    echo "Review: FAIL — curl timeout after ${SSE_SEC}s" >&2
    rm -f "${tmp}"
    return 1
  fi
  need_review_response "${tmp}"
  rm -f "${tmp}"
}

echo "P7: base URL ${BASE}"
"${CURLF[@]}" --max-time 5 "${BASE}/api/config" >/dev/null
echo "P7: app health OK"

MODEL="$(pick_model)"
echo "P7: using model ${MODEL}"

"${CURLF[@]}" --max-time 5 "${OLLAMA}/api/tags" >/dev/null
warm_ollama "${MODEL}"

CHAT_BODY="$(MODEL="${MODEL}" node -e 'process.stdout.write(JSON.stringify({messages:[{role:"user",content:"Say hello in one word"}],mode:"chat",model:process.env.MODEL}))')"
run_sse "Chat SSE" "/api/chat" "${CHAT_BODY}"

REVIEW_BODY="$(MODEL="${MODEL}" node -e 'process.stdout.write(JSON.stringify({code:"function add(a,b){return a+b}",language:"javascript",model:process.env.MODEL}))')"
run_review "${REVIEW_BODY}"

DIAG_BODY="$(MODEL="${MODEL}" node -e 'process.stdout.write(JSON.stringify({messages:[{role:"user",content:"Draw a simple flowchart: Start -> Process -> End"}],mode:"diagram",model:process.env.MODEL}))')"
run_sse "Diagram SSE" "/api/chat" "${DIAG_BODY}"

TOOLS_TMP="$(mktemp)"
"${CURLF[@]}" --max-time 30 -X POST "${BASE}/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  -o "${TOOLS_TMP}"
N="$(node -p "const r=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));(r.result&&r.result.tools&&r.result.tools.length)||0" "${TOOLS_TMP}")"
rm -f "${TOOLS_TMP}"
if [[ "${N}" -lt "${MIN_MCP}" ]]; then
  echo "MCP tools: FAIL (got ${N}, need >= ${MIN_MCP})" >&2
  exit 1
fi
echo "MCP tools: OK (${N} tools, min ${MIN_MCP})"

node -e "const p=require('./lib/prompts');const modes=['chat','explain','bugs','refactor','translate-tech','translate-biz','diagram','review','create','prompting','skillz','agentic'];const missing=modes.filter(m=>!p.SYSTEM_PROMPTS[m]);if(missing.length){console.error('Mode prompts: FAIL',missing.join(','));process.exit(1)}console.log('All 12 mode prompts: OK');"

echo "P7: all workflow checks passed."
