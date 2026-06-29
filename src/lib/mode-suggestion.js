/**
 * Best-effort, non-overriding mode-suggestion heuristic for the chat composer.
 *
 * Returns the mode id whose pattern most strongly matches the draft prompt, or
 * null if the current mode already fits / nothing matches confidently. The UI
 * surfaces this as a soft banner — clicking switches modes; otherwise the
 * user's mode pick is respected. Never silently routes work.
 *
 * The order of `MODE_PATTERNS` is the priority order: more specific patterns
 * first, so e.g. "security review" prefers `pentest` over `review`.
 */

const MODE_PATTERNS = [
  // Security trumps generic review when both could match.
  [
    "pentest",
    /\b(security review|owasp|vulnerab(?:le|ility|ilities)|pentest|penetration test|cve|sql injection|xss|csrf|threat model|audit (?:for|the) security|secure code review)\b/i,
  ],
  [
    "review",
    /\b(code review|review (?:my|this|the) (?:code|file|pull request|pr|diff)|grade (?:my|this) code|report card)\b/i,
  ],
  [
    "diagram",
    /\b(draw (?:a|me a)|create (?:a |an )?(?:flowchart|diagram|architecture diagram|sequence diagram)|mermaid|flowchart for|architecture (?:diagram|drawing)|visuali[sz]e (?:this|the))\b/i,
  ],
  [
    "bugs",
    /\b(find (?:the )?bugs?|why (?:is|isn't) (?:this|it) (?:work|broken|failing)|what(?:'s| is) wrong|debug this|spot (?:the )?(?:issue|bug|problem))\b/i,
  ],
  [
    "refactor",
    /\b(refactor|clean (?:up|this up)|simplify (?:this|the) (?:code|function)|tidy (?:up )?(?:my|this) code|de-?duplicate)\b/i,
  ],
  [
    "translate-tech",
    /\b(explain (?:this|the) code in plain english|translate (?:this )?code (?:to|into) (?:plain|english)|what does this code do)\b/i,
  ],
  [
    "translate-biz",
    /\b(turn (?:this|my) idea into (?:a )?spec|product requirements? doc|prd for|build (?:me )?a spec|code spec for)\b/i,
  ],
  [
    "explain",
    /\b(explain (?:this|the) (?:code|function|file)|walk me through (?:this|the) code|how does (?:this|the) code work)\b/i,
  ],
  [
    "validate",
    /\b(generate (?:a )?validate(?:\.md)?|create (?:a )?validate command|set up (?:project )?validation)\b/i,
  ],
  [
    "create",
    /\b(scaffold (?:a |an )?(?:new )?project|start (?:a |an )?new project|create (?:a |an )?new (?:project|repo|app))\b/i,
  ],
  [
    "build",
    /\b(build (?:me )?an app|th3rdai-?harness|harness|start (?:a |an )?build (?:project|cycle)|spin up (?:a |an )?(?:project|app))\b/i,
  ],
  [
    "planner",
    /\b(implementation plan|score (?:my|this) plan|design (?:a |an )?plan|review (?:my|this) plan)\b/i,
  ],
  [
    "prompting",
    /\b(score (?:my|this) prompt|optimi[sz]e (?:my|this) prompt|improve (?:my|this) prompt|better prompt)\b/i,
  ],
  [
    "skillz",
    /\b(create (?:a |an )?(?:claude )?skill|score (?:my|this) skill|agent skill)\b/i,
  ],
  [
    "agentic",
    /\b(design (?:a |an )?agent|score (?:my|this) agent|crewai|langgraph|agent (?:loop|workflow))\b/i,
  ],
];

/**
 * @param {string} draft - current textarea contents
 * @param {string} currentMode - active mode id
 * @returns {string|null} suggested mode id, or null
 */
export function suggestMode(draft, currentMode) {
  if (!draft || typeof draft !== "string") return null;
  const trimmed = draft.trim();
  // Only suggest once the user has typed something substantial — avoids flicker.
  if (trimmed.length < 25) return null;
  for (const [modeId, pattern] of MODE_PATTERNS) {
    if (modeId === currentMode) continue;
    if (pattern.test(trimmed)) return modeId;
  }
  return null;
}

export const MODE_SUGGESTION_PATTERNS = MODE_PATTERNS;
