# Th3rdAI Code Companion — Design Standards & Brand Guide

## Brand Identity

**App Name:** Th3rdAI Code Companion
**Tagline:** PM's Technical Translator
**Description:** A locally-hosted AI tool powered by Ollama that helps Product Managers understand, analyze, and communicate about code — without needing to be a developer.

### Logo

The Th3rdAI logo is a stylized eye icon with a blue-to-purple gradient, representing insight and AI vision. It lives at `/public/logo.svg`.

Usage rules:
- Always pair the eye icon with the "Th3rdAI" wordmark
- "Code Companion" appears as a secondary label in lighter weight
- Minimum clear space around the logo equals the height of the eye icon
- Never stretch, rotate, or recolor the logo outside the brand palette

### Naming Convention

- Full name: **Th3rdAI Code Companion**
- Brand name: **Th3rdAI** (always styled with capital T, number 3, lowercase rd, capital AI)
- Sub-brand: **Code Companion**
- In headers: "Th3rdAI" in gradient text + "Code Companion" in muted text
- In copy: "Th3rdAI Code Companion" on first mention, then "Code Companion" for brevity


## Color Palette

### Primary Brand Gradient

The core brand identity is a blue-to-purple gradient that matches the eye logo.

| Name          | Hex       | RGB              | Usage                        |
|---------------|-----------|------------------|------------------------------|
| Brand Blue    | `#3B82F6` | 59, 130, 246     | Gradient start, links        |
| Brand Indigo  | `#6366F1` | 99, 102, 241     | Primary brand, focus states  |
| Brand Purple  | `#8B5CF6` | 139, 92, 246     | Gradient end, accents        |
| Brand Cyan    | `#38BDF8` | 56, 189, 248     | Secondary accent, highlights |

**Gradient CSS:** `linear-gradient(135deg, #3B82F6, #6366F1, #8B5CF6)`

### Backgrounds

| Name          | Hex       | RGB              | Usage                        |
|---------------|-----------|------------------|------------------------------|
| Base          | `#0C0F1A` | 12, 15, 26       | Page background              |
| Surface       | `#141829` | 20, 24, 41       | Cards, panels, glass effects |
| Surface Light | `#1E2440` | 30, 36, 64       | Hover states, elevated cards |

### Text Colors

| Name          | Hex       | Tailwind Class   | Usage                        |
|---------------|-----------|------------------|------------------------------|
| Primary       | `#F8FAFC` | `slate-50`       | Body text, headings          |
| Secondary     | `#E2E8F0` | `slate-200`      | Strong emphasis in prose     |
| Muted         | `#94A3B8` | `slate-400`      | Descriptions, timestamps     |
| Dimmed        | `#64748B` | `slate-500`      | Subtle labels, counts        |

### Semantic Colors

| Name     | Hex       | Usage                          |
|----------|-----------|--------------------------------|
| Success  | `#22C55E` | Confirmations, online status   |
| Warning  | `#F59E0B` | Caution notices, slow states   |
| Danger   | `#EF4444` | Errors, destructive actions    |
| Info     | `#38BDF8` | Informational highlights       |


## Typography

### Font Stack

| Type      | Fonts                                                     | CSS Variable       |
|-----------|-----------------------------------------------------------|---------------------|
| Sans      | Inter, system-ui, -apple-system, sans-serif               | `--font-sans`       |
| Monospace | JetBrains Mono, Fira Code, Cascadia Code, monospace       | `--font-mono`       |

### Scale (within the app)

- **App title "Th3rdAI":** `text-lg font-bold` with gradient `bg-clip-text`
- **Sub-title "Code Companion":** `text-base font-medium text-slate-300`
- **Section headings:** `text-sm font-semibold text-slate-300`
- **Body text:** `text-sm text-slate-300` (default)
- **Small labels:** `text-xs text-slate-500`
- **Code blocks:** `font-mono text-[0.85em]`


## CSS Custom Properties

Defined in the `@theme` block of `src/index.css`:

```css
@theme {
  --color-base: #0c0f1a;
  --color-surface: #141829;
  --color-surface-light: #1e2440;
  --color-brand: #6366f1;
  --color-brand-blue: #3b82f6;
  --color-brand-purple: #6366f1;
  --color-cyan: #38bdf8;
  --color-neon: #6366f1;
  --color-neon-glow: rgba(99, 102, 241, 0.4);
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
}
```


## Tailwind Utility Conventions

The app uses **Tailwind CSS v4** with the indigo palette as the primary brand color in utility classes.

### Brand Color Mapping (Tailwind classes)

| Purpose                  | Class Pattern        | Example                       |
|--------------------------|----------------------|-------------------------------|
| Interactive backgrounds  | `indigo-600/20`      | Sidebar active item           |
| Borders on active items  | `indigo-500/30`      | Attached file chips           |
| Accent text              | `indigo-300`         | Prose headings, hover labels  |
| Icon/label color         | `indigo-400`         | Active indicators, dot pulses |
| Subtle backgrounds       | `indigo-500/10`      | Hover highlights              |
| Light text on dark       | `indigo-200`         | Panel labels                  |

**Important:** The project migrated from `violet-*` to `indigo-*` classes. Never use `violet-*` Tailwind utilities.


## Visual Effects

### Glass Morphism

Three glass tiers used for panels and cards:

| Class         | Background Alpha | Blur   | Usage                  |
|---------------|------------------|--------|------------------------|
| `.glass`      | 0.6              | 16px   | Standard panels        |
| `.glass-heavy`| 0.85             | 24px   | Modal overlays         |
| `.glass-neon` | 0.5              | 20px   | Feature-highlighted UI |

All glass effects use `rgba(20, 24, 41, ...)` (the Surface color) as the base.

### Neon Glow Effects

- `.neon-border` — Subtle indigo border with glow shadow
- `.neon-text` — Text with indigo glow shadow
- `.neon-glow-sm` — Small box glow for badges/indicators
- `.glow-pulse` — Animated glow that pulses in and out
- `.border-glow` — Border color that animates between dim and bright

### Button Styles

| Class       | Style                                    | Usage               |
|-------------|------------------------------------------|----------------------|
| `.btn-neon` | Gradient bg + glow shadow + hover lift   | Primary CTA buttons  |

Button gradient: `linear-gradient(135deg, #3B82F6, #6366F1, #8B5CF6)`

### Input Styles

| Class         | Style                                    | Usage               |
|---------------|------------------------------------------|----------------------|
| `.input-glow` | Dark bg with indigo glow on focus        | Text inputs, areas   |

### Animations

| Class         | Effect                   | Duration  | Usage                    |
|---------------|--------------------------|-----------|--------------------------|
| `.fade-in`    | Slide up + fade          | 0.3s      | New messages, panels     |
| `.typing-dot` | Pulsing opacity          | 1.4s loop | AI typing indicator      |
| `.spin`       | 360° rotation            | 1s loop   | Loading spinners         |
| `.glow-pulse` | Glow intensity cycle     | 3s loop   | Active state indicators  |
| `.shimmer`    | Horizontal light sweep   | 3s loop   | Loading placeholders     |
| `.border-glow`| Border brightness cycle  | 3s loop   | Panel focus borders      |


## Component Patterns

### Header Layout

```
[Eye Logo 32x32] [Th3rdAI (gradient)] [Code Companion (muted)]
                  [PM's Technical Translator (xs, dimmed)]
```

### Mode Tabs

Each mode has an emoji icon + label. Active tab uses `indigo-600/20` background with `indigo-300` text.

| Mode         | Icon | Description              |
|--------------|------|--------------------------|
| Chat         | 💬   | Freeform conversation    |
| Explain      | 💡   | What does this code do?  |
| Bug Hunter   | 🐛   | Find issues & risks      |
| Refactor     | ✨   | Improve this code        |
| Tech → Biz   | 📋   | Technical to business    |
| Biz → Tech   | 🔧   | Business to technical    |

### Message Bubbles

- **User messages:** Darker surface background, right-aligned context
- **AI messages:** Glass background with prose styling
- **Code blocks:** `#0C0F1A` background with indigo border accent

### Sidebar

- Conversation list with glass panel background
- Active item: `indigo-600/20` bg + `indigo-500/30` border
- Hover: `indigo-500/10` background


## Accessibility

- Focus visible outlines: 2px solid `#6366F1` with 2px offset
- Skip link provided for keyboard navigation
- `.sr-only` class for screen-reader-only content
- All interactive elements have `aria-label` attributes
- Color contrast ratios meet WCAG AA for text on dark backgrounds


## Assets

| File                       | Size    | Purpose                 |
|----------------------------|---------|-------------------------|
| `/public/logo.svg`         | vector  | App header logo         |
| `/public/favicon.png`      | 32×32   | Browser tab icon        |
| `/public/apple-touch-icon.png` | 180×180 | iOS home screen icon |
| `/public/icon-192.png`     | 192×192 | PWA / Android icon      |


## Tone of Voice

**Professional but approachable.** Think "senior engineer explaining to a smart PM" — no condescension, no jargon without explanation.

### Audience

Product Managers who lead development teams. They're technical enough to read code but want plain-English summaries and business context.

### Writing Guidelines

- Use conversational language, not academic
- Explain technical terms inline (parenthetical definitions are fine)
- Lead with the "so what" — why should a PM care?
- Keep responses scannable with clear structure
- Code blocks should always include syntax highlighting
- Streaming text should feel conversational, not robotic
