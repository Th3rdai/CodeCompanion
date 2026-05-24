# PCI-Assistant Speed Optimization Investigation

**Date:** 2026-05-16
**Issue:** PCI-Assistant MCP tool calls taking ~110 seconds
**Status:** ✅ Resolved - Reliability prioritized over speed

## Summary

Investigation into speeding up PCI-Assistant integration revealed that **smaller models achieve 4-5x speed improvements but have reliability issues**, especially in longer conversations. Final resolution: use larger model (`qwen3.6:latest` 23.9GB) with prompt engineering improvements for best reliability.

## Timeline

### Initial Performance (Baseline)

- **Model:** `qwen3.6:latest` (23.9GB)
- **Response Time:** ~110 seconds
- **MCP Tool Execution:** 18-22ms (fast)
- **Bottleneck:** Model thinking time, not MCP communication
- **Reliability:** ✅ Perfect - consistent instruction following

### Optimization Attempt 1: qwen2.5:7b

- **Model:** `qwen2.5:7b` (4.6GB)
- **Response Time:** 22.7 seconds ✅ (4.8x faster)
- **Tool Execution:** 19ms (fast)
- **Reliability:** ❌ **FAILED**
  - Tool call succeeded but model attempted file writing instead of presenting results
  - Triggered "narrated action without tool call" error
  - Would describe actions instead of executing proper TOOL_CALL

### Optimization Attempt 2: qwen3:latest

- **Model:** `qwen3:latest` (5.2GB)
- **Response Time:** 26-82 seconds ✅ (initially promising)
- **Tool Execution:** 22-306ms (fast)
- **Reliability:** ❌ **FAILED** (same issues as qwen2.5:7b)
  - Short conversations: worked with prompt fix
  - Long conversations (13+ messages): degraded reliability
  - Wrong tool selection (called `requirement_lookup` instead of `evidence_analysis`)

### Final Solution: qwen3.6:latest + Prompt Engineering

- **Model:** `qwen3.6:latest` (23.9GB) - original reliable model
- **Response Time:** ~110 seconds (acceptable)
- **Reliability:** ✅ **Perfect**
- **Prompt Fix Applied:** `lib/chat-post-handler.js:1960-1968`

## Root Cause Analysis

### Why Smaller Models Failed

1. **Instruction Following Degradation**
   - Models < 10GB struggle with complex multi-step instructions
   - Tendency to "be helpful" by taking autonomous actions (file writing, extra steps)
   - Cannot reliably follow explicit "present results now" instructions

2. **Context Window Stress**
   - Tested at 13 messages, 16,839 tokens
   - Smaller models' reliability degrades as context grows
   - Critical for long troubleshooting sessions

3. **Tool Selection Capability**
   - When presented with multiple similar tools, smaller models choose incorrectly
   - Example: Asked for `evidence_analysis`, model called `requirement_lookup`
   - Larger models understand semantic differences between tool purposes

### Prompt Engineering Fix

**File:** `lib/chat-post-handler.js`
**Lines:** 1960-1968

**Before (vague):**

```javascript
"Present these results to the user in a helpful response.";
```

**After (explicit):**

```javascript
`⚡ PRESENT RESULTS NOW — The tool has completed successfully. Present the tool results to the user immediately in a clear, direct response. Do NOT:
- Write files or take additional actions
- Narrate what you "will" do next
- Add extra steps beyond presenting these results
- Output TOOL_CALL again unless the user asks a follow-up question

Simply show the user what the tool returned. If the user later asks for revisions, you MUST call the tool again with updated parameters.`;
```

**Impact:**

- ✅ Helps larger models present results cleanly
- ⚠️ Helps smaller models in SHORT conversations only
- ❌ Doesn't fix fundamental capability gaps in long conversations

## Performance Comparison

| Model              | Size   | Speed     | Short Conv    | Long Conv   | Tool Select    | Production Ready |
| ------------------ | ------ | --------- | ------------- | ----------- | -------------- | ---------------- |
| **qwen3.6:latest** | 23.9GB | 110s ❌   | ✅ Perfect    | ✅ Perfect  | ✅ Perfect     | ✅ **YES**       |
| qwen3:latest       | 5.2GB  | 26-82s ✅ | ✅ With fix   | ❌ Degrades | ❌ Wrong tools | ❌ NO            |
| qwen2.5:7b         | 4.6GB  | 22.7s ✅  | ❌ Unreliable | ❌ Fails    | ❌ Wrong tools | ❌ NO            |

## Recommendations

### For Production Use

✅ **Use `qwen3.6:latest` (23.9GB)**

- Reliable instruction following
- Handles long conversations
- Correct tool selection
- ~110 second response time is acceptable for reliability

### Configuration

In `.cc-config.json`:

```json
{
  "autoModelMap": {
    "chat": "qwen3.6:latest"
  }
}
```

### For Experimentation Only

⚠️ Smaller models can be used for:

- Short conversations (< 5 messages)
- Single tool calls
- Speed demonstrations
- Non-critical use cases

**Never use for:**

- Production troubleshooting
- Long investigative sessions
- Critical data analysis
- Complex tool selection scenarios

## Lessons Learned

### 1. MCP Performance is Not the Bottleneck

- MCP tool execution: 18-306ms (consistently fast)
- Model thinking time: 22-110 seconds (actual bottleneck)
- Focus optimization on model selection, not MCP transport

### 2. Model Size vs Capability Trade-off

- Size reduction: 23.9GB → 5.2GB = 78% smaller
- Speed improvement: 110s → 26s = 4.2x faster
- Reliability cost: Perfect → Unreliable = **Unacceptable**

### 3. Context Window Matters

- Short conversations (< 10 messages): Smaller models work
- Long conversations (13+ messages, 16K+ tokens): Only larger models reliable
- Critical for debugging/troubleshooting workflows

### 4. Prompt Engineering Has Limits

- Can improve presentation in short conversations
- Cannot compensate for fundamental model capability gaps
- Essential but not sufficient for smaller models

## Testing Methodology

### Test Case: requirement_lookup("11.3.1")

1. User requests PCI requirement lookup
2. Model must make proper TOOL_CALL
3. MCP tool executes and returns data
4. Model must present results clearly (no file writing, no narration)

### Success Criteria

✅ Tool call made correctly
✅ Results retrieved (18-22ms)
✅ Results presented to user
✅ No "narrated action" errors
✅ No autonomous file operations

### Failure Modes Observed

❌ Model narrates instead of making TOOL_CALL
❌ Model makes tool call but then attempts file writing
❌ Model selects wrong tool (`requirement_lookup` vs `evidence_analysis`)
❌ Reliability degrades after 10+ messages

## Files Modified

### 1. lib/chat-post-handler.js (lines 1960-1968)

**Purpose:** Explicit tool result presentation instructions
**Benefit:** Helps all models present results cleanly
**Limitation:** Doesn't fix capability gaps in smaller models

### 2. .cc-config.json (not committed - contains secrets)

**Change:** Set `autoModelMap.chat` to `qwen3.6:latest`
**Documented:** This file
**Location:** `~/.config/code-companion/.cc-config.json` or user's config directory

## Related Documentation

- `PCI-ASSISTANT-ISSUE-SUMMARY.md` - Original investigation
- `PCI-REQUIREMENT-TEST-CHECKLIST.md` - Testing guide
- `docs/TROUBLESHOOTING.md` - General troubleshooting
- `lib/chat-post-handler.js` - Implementation details

## Future Improvements

### Potential Optimizations (Low Priority)

1. **Streaming Optimization** - Could reduce perceived latency
2. **Caching** - For repeated requirement lookups
3. **Model Quantization** - Test Q4/Q5 versions of large models

### Why Not Pursued

- Current performance (110s) is acceptable
- Reliability is more critical than speed
- User confirmed working solution satisfactory

## Conclusion

**Final Decision:** Reliability > Speed for production use.

While smaller models (qwen2.5:7b, qwen3:latest) achieve impressive 4-5x speed improvements, they fail reliability requirements for production troubleshooting workflows. The combination of `qwen3.6:latest` (23.9GB) with prompt engineering improvements provides the best user experience with consistent, predictable behavior.

**Status:** ✅ **Resolved and Deployed**
**User Confirmation:** "it is working!"
**Date:** 2026-05-16
