# Privacy messaging

How Code Companion explains data handling to vibe coders — in the UI, onboarding, and optional cloud providers.

## User-facing surfaces

| Surface                  | Location                                       | When shown                                                                           |
| ------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Privacy banner**       | Bottom of app (`PrivacyBanner.jsx`)            | Until dismissed; re-show from Settings → General                                     |
| **Onboarding — welcome** | Step 1 (`OnboardingWizard.jsx`)                | First launch                                                                         |
| **Onboarding — Ollama**  | Step 2                                         | Connect-to-Ollama guidance                                                           |
| **Onboarding — privacy** | Step 6 “Your Data Stays Here”                  | Four bullets: local default, no CC tracking, local JSON history, optional OpenRouter |
| **Image upload notice**  | First image attach (`ImagePrivacyWarning.jsx`) | Separate from LLM provider choice                                                    |

## Messaging principles (v1.7.4+)

1. **Privacy-first by default** — Ollama is the default; code and conversations stay on the machine unless the user opts into cloud models.
2. **OpenRouter is explicit** — When enabled (Settings → General → **AI provider** → OpenRouter), chat/review/etc. go to [OpenRouter](https://openrouter.ai) under **their** terms and the user’s API key. Code Companion does not imply “nothing leaves your computer” in that mode.
3. **Code Companion ≠ provider** — The app does not track users, require accounts, or sell conversation data. Provider traffic is separate from app telemetry (there is none).
4. **Memory stays local** — Embedding memory always uses Ollama even when OpenRouter is the active chat provider (`docs/PROVIDERS.md`, `lib/memory.js`).

## Current banner copy

> **Privacy-first by default.** Ollama runs AI on your machine — your code and conversations stay local. Turn on **OpenRouter** in Settings only if you want cloud models (chat then goes to their API). Code Companion doesn't track you, require accounts, or collect your data.

Dismissal key: `localStorage` → `th3rdai_privacy_banner_dismissed`. Reset via Settings or `resetPrivacyBanner()`.

## Related docs

- **`docs/PROVIDERS.md`** — Ollama vs OpenRouter routing (developer map)
- **`docs/ENVIRONMENT_VARIABLES.md`** — `provider`, `openrouterApiKey`, `OPENROUTER_API_KEY`
- **`docs/IMAGES.md`** — image upload privacy modal
- **`tests/ui/privacy-banner.spec.js`** — UX-04 Playwright coverage

## Tests

```bash
npx playwright test tests/ui/privacy-banner.spec.js --project=chromium
npx playwright test tests/ui/onboarding.spec.js tests/ui/OnboardingWizard.spec.js --project=chromium
```
