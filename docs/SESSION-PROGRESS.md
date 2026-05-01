# Session progress indicator

Code Companion shows a **consistent “Working” strip** whenever the app is waiting on the model or a long-running step, so users see activity even if the main transcript is scrolled away.

## Component

| Path                                        | Role                                                                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ui/ChatSessionProgress.jsx` | Glass strip: pulse dot, title **Working**, subtitle line, 3px indeterminate bar                                                              |
| `src/index.css`                             | `.cc-chat-progress-track` / `.cc-chat-progress-segment` + `@keyframes cc-chat-progress-slide`; reduced-motion uses a static centered segment |

### Props

| Prop        | Type              | Notes                                                             |
| ----------- | ----------------- | ----------------------------------------------------------------- |
| `active`    | boolean           | When `false`, renders nothing                                     |
| `modeLabel` | string            | Used with default subtitle: `{modeLabel} — generating a response` |
| `detail`    | string (optional) | Full subtitle; overrides `modeLabel` when set                     |
| `testId`    | string (optional) | Defaults to `chat-session-progress`; use per-surface ids in tests |

Accessibility: `role="status"`, `aria-live="polite"`, `aria-busy="true"`, and `aria-label` include the subtitle.

## Where it appears

| Surface                                | When visible                                                                            | Typical `detail` / notes                           |
| -------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Main app (`App.jsx`)                   | `streaming` from `useChat`                                                              | Current mode label                                 |
| Builder modes (`BaseBuilderPanel.jsx`) | Scoring (`phase === "loading"`), revise SSE                                             | `{Prompting \| …} · Scoring…` / `· Revise with AI` |
| Review (`ReviewPanel.jsx`)             | Loading, `deepDiveStreaming`, fallback SSE (`fallbackSseActive`)                        | Review-specific lines                              |
| Security (`SecurityPanel.jsx`)         | Loading, `remediating`, fallback markdown SSE, `fallbackStreaming`, `deepDiveStreaming` | Security-specific lines                            |
| Experiment (`ExperimentPanel.jsx`)     | `streaming` during a step                                                               | Shown with existing `RunningProgress`              |
| Deep dive (`DeepDivePanel.jsx`)        | `streaming`                                                                             | Uses panel `title`                                 |
| Build simple (`BuildSimpleView.jsx`)   | Research/plan stream or What’s Next `loading`                                           | Build phase strings                                |

## Releases

The strip ships in the **SPA `dist/`** bundle. Packaged Electron builds pick it up on the next **production build** (see `BUILD.md` / `docs/RELEASES-AND-UPDATES.md`).
