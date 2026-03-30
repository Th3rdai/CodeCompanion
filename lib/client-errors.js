"use strict";

/**
 * Safe JSON message for HTTP 5xx responses. Never echo err.message to clients.
 */
const CLIENT_INTERNAL_ERROR =
  "An unexpected error occurred. Please try again later.";

/** SSE / stream errors — same policy as 5xx JSON (no stack or syscall text). */
const STREAM_INTERNAL_ERROR = CLIENT_INTERNAL_ERROR;

module.exports = { CLIENT_INTERNAL_ERROR, STREAM_INTERNAL_ERROR };
