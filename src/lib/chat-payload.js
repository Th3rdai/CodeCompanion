/**
 * POST /api/chat uses express.json with a 50MB cap for this route.
 * Check before sending so the user gets a clear toast instead of "Failed to fetch".
 */
export const MAX_CHAT_POST_BYTES = 48 * 1024 * 1024;

export function estimateChatPostBodyBytes(body) {
  try {
    return new TextEncoder().encode(JSON.stringify(body)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
