# Phase 4: Vision Model Detection & UI - Coordination Notes

**Status**: 🟡 IN PROGRESS
**Agent**: Agent-Foundation
**Started**: 2026-03-17

---

## Coordination with Phase 2

Phase 4 (Vision Detection UI) is being developed **in parallel** with Phase 2 (Frontend Upload).

### Assumptions About Attachment State (from Phase 2)

I'm implementing Phase 4 based on the planned attachment state structure from `.planning/IMAGE_SUPPORT_PLAN.md`:

```javascript
// Expected attachedFiles state structure after Phase 2
[
  {
    name: string,           // Filename
    content: string,        // Text content OR base64 (NO prefix for images)
    type: 'text' | 'image', // File type

    // Text-only fields
    lines?: number,

    // Image-only fields
    isImage?: boolean,
    thumbnail?: string,     // Data URI for display (WITH prefix)
    size?: number,          // Bytes
    dimensions?: { width: number, height: number },
    format?: 'png' | 'jpeg' | 'gif',
    hash?: string           // MD5 for duplicate detection
  }
]
```

### What Phase 4 Needs from Phase 2

1. **attachedFiles state** with the structure above
2. **hasImages detection**: Check if any file has `type === 'image'` or `isImage === true`
3. **removeAttachment(index)** function or similar to remove individual files

### What Phase 4 Will Provide

1. **Vision model detection logic**:
   - Check if `selectedModel` has `supportsVision` property
   - Check backend `/api/models` response includes vision models

2. **Warning banner** when `hasImages && !selectedModel.supportsVision`

3. **Quick action functions**:
   - `switchToVisionModel()` - Auto-select first available vision model
   - `removeAllImages()` - Remove all image attachments

### Integration Points

#### In App.jsx, I'll add:

1. **State/Derived Values**:

```javascript
const hasImages = attachedFiles.some((f) => f.type === "image" || f.isImage);
const selectedModelInfo = models.find((m) => m.name === selectedModel);
const isVisionModel = selectedModelInfo?.supportsVision || false;
const showVisionWarning = hasImages && !isVisionModel;
const canSend = input.trim() && !showVisionWarning; // Disable send when invalid
```

2. **Warning Banner JSX** (before textarea):

```jsx
{
  showVisionWarning && (
    <div className="bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 p-3 mb-2">
      <p className="text-sm text-yellow-800 dark:text-yellow-200">
        ⚠️ Current model doesn't support images.
        <button onClick={switchToVisionModel} className="underline ml-1">
          Switch to vision model
        </button>
        {" or "}
        <button onClick={removeAllImages} className="underline">
          remove images
        </button>
      </p>
    </div>
  );
}
```

3. **Model Selector Enhancement**:

```jsx
{
  /* In model dropdown */
}
<select value={selectedModel} onChange={handleModelChange}>
  {sortedModels.map((model) => (
    <option key={model.name} value={model.name}>
      {model.supportsVision && "👁️ "}
      {model.name}
    </option>
  ))}
</select>;
```

### Merge Strategy

When Phase 2 completes:

1. Phase 2 agent implements attachment state structure
2. Phase 2 agent implements `hasImages` derived value
3. My Phase 4 code will integrate seamlessly (reads same state)
4. **Potential conflict**: If Phase 2 also modifies model selector, we coordinate the merge

### Files I'm Modifying

- `src/App.jsx` (adding vision warning logic, NOT modifying upload logic)
- Specifically adding:
  - Vision model detection logic
  - Warning banner JSX
  - Quick action functions
  - Model selector enhancement (vision badges)

---

## For Phase 2 Agent

**Hey Phase 2 agent!** 👋

I'm working on Phase 4 (Vision Detection UI) in parallel. Here's what you need to know:

### What I Need From You

Please implement the attachment state structure as documented above:

- `attachedFiles` array with `type: 'text' | 'image'`
- Image-specific fields: `isImage`, `thumbnail`, `dimensions`, `format`, `hash`

### What I'm Adding

I'm adding vision model warnings and badges. My code will:

- Check `attachedFiles.some(f => f.type === 'image')` to detect images
- Show a warning if images are attached but model doesn't support vision
- Add 👁️ badges to vision models in the dropdown

### How to Merge

When you're done with Phase 2:

1. Your changes: File upload logic, attachment rendering
2. My changes: Warning banner, vision badges
3. **Minimal overlap** - should merge cleanly

If you need to modify the model selector or warning area, ping me in the tracker!

---

## Testing Plan

After both Phase 2 and Phase 4 complete:

1. ✅ Upload an image (Phase 2 functionality)
2. ✅ Select a non-vision model (e.g., llama3)
3. ✅ Warning banner should appear (Phase 4 functionality)
4. ✅ Click "Switch to vision model" → Should auto-select llava
5. ✅ Warning disappears, send button enabled
6. ✅ Verify 👁️ badge appears next to vision models

---

**Status**: Starting Phase 4 implementation now
**Next Update**: When Phase 4 tasks complete
