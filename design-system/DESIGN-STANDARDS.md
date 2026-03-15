# Code Companion — Design Standards & Guidelines

**Version:** 1.0
**Last Updated:** 2026-03-14
**Aesthetic:** Cyberpunk Neon Glass Morphism
**Theme:** Dark-only

---

## 1. Brand Identity

### Core Aesthetic
Code Companion uses a **cyberpunk neon glass morphism** aesthetic — deep navy backgrounds with frosted glass surfaces, indigo neon accents, and subtle particle effects. The visual language communicates "intelligent, premium, approachable tech tool."

### Logo & Naming
- **Product:** Th3rdAI Code Companion
- **Tagline:** Vibe Coder Edition
- **Theme Color:** `#0c0f1a` (deep navy)
- **Favicon:** `/favicon.png` (PNG format)
- **Apple Touch Icon:** `/apple-touch-icon.png`

---

## 2. Color System

### 2.1 Background Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--color-base` | `#0c0f1a` | Body background, deepest layer |
| `--color-surface` | `#141829` | Card surfaces, panels |
| `--color-surface-light` | `#1e2440` | Elevated surfaces, hover states |

### 2.2 Brand Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-brand` | `#6366f1` | Primary brand — indigo |
| `--color-brand-blue` | `#3b82f6` | Secondary — blue |
| `--color-brand-purple` | `#8b5cf6` | Tertiary — purple (gradients) |
| `--color-cyan` | `#38bdf8` | Accent — cyan highlights |
| `--color-neon` | `#6366f1` | Neon glow source |
| `--color-neon-glow` | `rgba(99, 102, 241, 0.4)` | Neon glow with alpha |

### 2.3 Text Colors

| Class | Hex | Usage |
|-------|-----|-------|
| `text-white` / `text-slate-50` | `#f8fafc` | High-emphasis headings |
| `text-slate-100` | `#f1f5f9` | Primary body text |
| `text-slate-200` | `#e2e8f0` | Standard body text |
| `text-slate-300` | `#cbd5e1` | Secondary text |
| `text-slate-400` | `#94a3b8` | Labels, helpers, placeholders |
| `text-slate-500` | `#64748b` | Muted, tertiary |
| `text-slate-600` | `#475569` | Very muted, disabled |
| `text-indigo-300` | `#a5b4fc` | Accent text, active states |
| `text-indigo-400` | `#818cf8` | Links, interactive accent |

### 2.4 Status Colors

| Status | Background | Border | Text | Usage |
|--------|-----------|--------|------|-------|
| Success | `bg-emerald-500/20` | `border-emerald-500/40` | `text-emerald-300` | Grade A, success states |
| Good | `bg-blue-500/20` | `border-blue-500/40` | `text-blue-300` | Grade B, info |
| Warning | `bg-amber-500/20` | `border-amber-500/40` | `text-amber-300` | Grade C, caution |
| Caution | `bg-orange-500/20` | `border-orange-500/40` | `text-orange-300` | Grade D, needs work |
| Danger | `bg-red-500/20` | `border-red-500/40` | `text-red-300` | Grade F, errors, critical |

### 2.5 Grade Color Mapping

| Grade | Semantic | BG | Border | Text | Ring |
|-------|----------|-----|--------|------|------|
| A | Excellent | `emerald-500/20` | `emerald-500/40` | `emerald-300` | `emerald-500` |
| B | Good | `blue-500/20` | `blue-500/40` | `blue-300` | `blue-500` |
| C | Okay | `amber-500/20` | `amber-500/40` | `amber-300` | `amber-500` |
| D | Needs Work | `orange-500/20` | `orange-500/40` | `orange-300` | `orange-500` |
| F | Fail | `red-500/20` | `red-500/40` | `red-300` | `red-500` |

### 2.6 Severity Colors

| Severity | Text | Background | Border |
|----------|------|-----------|--------|
| Critical | `text-red-400` | `bg-red-500/15` | `border-red-500/30` |
| High | `text-orange-400` | `bg-orange-500/15` | `border-orange-500/30` |
| Medium | `text-amber-400` | `bg-amber-500/15` | `border-amber-500/30` |
| Low | `text-blue-400` | `bg-blue-500/15` | `border-blue-500/30` |

### 2.7 Gradients

```
Primary CTA:     linear-gradient(135deg, #3b82f6, #6366f1, #8b5cf6)
Brand Text:      bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400
Strong Brand:    bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500
Page Background: bg-gradient-to-br from-base via-surface to-surface-light
Mesh (subtle):   Radial gradients — blue(0.08), cyan(0.06), purple(0.05) opacity
```

---

## 3. Typography

### 3.1 Font Stack

| Role | Family | Weights | CSS Variable |
|------|--------|---------|-------------|
| UI / Body | Inter | 300, 400, 500, 600, 700 | `--font-sans` |
| Code / Mono | JetBrains Mono | 400, 500 | `--font-mono` |

**Google Fonts Import:**
```
Inter:wght@300;400;500;600;700
JetBrains Mono:wght@400;500
```

### 3.2 Type Scale

| Element | Size | Weight | Color | Class |
|---------|------|--------|-------|-------|
| App Title | `text-base` (16px) | 700 | Gradient (blue-indigo-purple) | `font-bold bg-clip-text` |
| Modal Title | `text-lg` (18px) | 700 | `slate-100` | `font-bold text-slate-100` |
| Section Title | `text-sm` (14px) | 600 | `slate-200` | `font-semibold text-slate-200` |
| Body | `text-sm` (14px) | 400 | `slate-200` / `slate-300` | `text-slate-200` |
| Label | `text-xs` (12px) | 500 | `slate-400` | `font-medium text-slate-400` |
| Caption | `text-xs` (12px) | 400 | `slate-500` | `text-slate-500` |
| Badge | `text-[9px]` / `text-[10px]` | 700 | Varies | `font-bold` |
| Code | `text-sm` (14px) | 400 | `slate-200` | `font-mono` |

### 3.3 Prose Styles (Markdown Content)

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| h2 | 1.15rem | 700 | `#a5b4fc` (indigo-300) |
| h3 | 1rem | 600 | `#e2e8f0` (slate-200) |
| p | inherit | 400 | inherit, `line-height: 1.6` |
| code (inline) | 0.85em | 400 | `bg: #334155`, `px: 0.4rem` |
| pre (block) | inherit | 400 | `bg: #0c0f1a`, `border: indigo-500/15` |
| strong | inherit | 700 | `#e2e8f0` |

---

## 4. Glass Morphism System

The core visual language. Three tiers of glass effects.

### 4.1 Glass Variants

| Class | Background | Blur | Border | Usage |
|-------|-----------|------|--------|-------|
| `.glass` | `rgba(20, 24, 41, 0.6)` | `blur(16px)` | `rgba(148, 163, 184, 0.08)` | Default cards, info boxes |
| `.glass-heavy` | `rgba(20, 24, 41, 0.85)` | `blur(24px)` | `rgba(148, 163, 184, 0.1)` | Headers, footers, modals, sidebar |
| `.glass-neon` | `rgba(20, 24, 41, 0.5)` | `blur(20px)` | `rgba(99, 102, 241, 0.25)` | User messages, accent cards, toasts |

### 4.2 Neon Effects

| Class | Effect | Usage |
|-------|--------|-------|
| `.neon-border` | Indigo border + outer glow shadow | Modal containers, emphasis cards |
| `.neon-text` | Indigo text-shadow (10px + 20px) | Headings, accent text |
| `.neon-glow-sm` | Subtle box-shadow glow | Active tab indicators |

### 4.3 Glow Animations

| Class | Animation | Duration | Usage |
|-------|-----------|----------|-------|
| `.glow-pulse` | Box-shadow pulses (5px to 45px) | 3s infinite | Status indicators, active badges |
| `.border-glow` | Border color fades (0.3 to 0.7 opacity) | 3s infinite | Focused inputs, active elements |
| `.shimmer` | Background position shift | 3s linear infinite | Loading states |

---

## 5. Component Library

### 5.1 Buttons

#### Primary (Neon CTA)
```
Class: btn-neon
Background: linear-gradient(135deg, #3b82f6, #6366f1, #8b5cf6)
Border: 1px solid rgba(129, 140, 248, 0.5)
Shadow: 0 0 15px rgba(99, 102, 241, 0.3), 0 4px 12px rgba(0, 0, 0, 0.3)
Hover: shadow intensifies, border brightens, translateY(-1px)
Active: translateY(0), reduced shadow
Pairs with: rounded-xl, px-4, py-2.5, font-medium
```

#### Secondary (Glass)
```
Class: glass
Text: text-slate-400 hover:text-indigo-300
Hover: hover:bg-indigo-500/10
Pairs with: rounded-lg, px-2.5, py-1.5, text-xs
```

#### Danger
```
Text: text-red-400/70 hover:text-red-400
Border: border-red-500/20
Hover: hover:bg-red-500/10
Pairs with: rounded-lg, px-2.5, py-1.5, text-xs
```

#### Disabled State
```
All buttons: disabled:opacity-50, cursor-not-allowed
```

### 5.2 Inputs

#### Text Input / Textarea
```
Class: input-glow
Background: rgba(15, 23, 42, 0.8)
Border: 1px solid rgba(71, 85, 105, 0.5)
Focus: border-color rgba(99, 102, 241, 0.6) + box-shadow glow
Text: text-slate-100 or text-slate-200
Placeholder: placeholder-slate-500
Pairs with: rounded-lg (inputs), rounded-xl (textarea), px-4, py-3
```

#### Tag Input
```
Container: flex flex-wrap gap-1.5 input-glow rounded-xl px-3 py-2 min-h-[42px]
Tags: bg-indigo-500/20 text-indigo-300 border-indigo-500/30 rounded-full px-2.5 py-0.5
Remove: text-indigo-400 hover:text-indigo-200
```

### 5.3 Tabs

#### Mode Tabs
```
Container: glass border-b border-slate-700/30 px-3 py-2 flex flex-wrap gap-1.5
Active:   bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-medium neon-glow-sm
Inactive: text-slate-400 hover:bg-indigo-500/10 hover:text-slate-200
Locked:   opacity-60 text-slate-500 hover:opacity-80
PRO Badge: text-[9px] font-bold text-indigo-400 bg-indigo-500/20 px-1 py-0.5 rounded
```

#### Settings Tabs
```
Active:   bg-indigo-600/40 text-indigo-200
Inactive: bg-slate-700/50 text-slate-500 hover:text-slate-300
```

### 5.4 Modals

```
Overlay:   fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4
Container: glass-heavy rounded-2xl w-full max-w-{sm|md} p-6 neon-border
Close:     text-slate-400 hover:text-white text-xl transition-colors
ARIA:      role="dialog" aria-label="..." aria-modal="true"
```

### 5.5 Toast Notifications

```
Position: fixed bottom-6 right-6 z-50
Style:    glass-neon text-slate-200 text-sm px-4 py-2.5 rounded-xl shadow-lg fade-in
Duration: 3000ms auto-dismiss
ARIA:     role="status" aria-live="polite"
```

### 5.6 Banners / Alerts

| Type | Background | Border | Text |
|------|-----------|--------|------|
| Warning | `bg-amber-500/10` | `border-amber-500/30` | `text-amber-300` |
| Error | `bg-red-500/10` | `border-red-500/30` | `text-red-400` |
| Success | `bg-green-500/10` | `border-green-500/30` | `text-green-400` |
| Info | `bg-blue-500/10` | `border-blue-500/30` | `text-blue-400` |

### 5.7 Cards

```
Standard: glass rounded-xl border border-slate-700/30 p-4
Hover:    hover:border-slate-600/50
Finding:  glass rounded-xl border border-slate-700/30 p-3 space-y-2
```

### 5.8 Badges

#### Grade Badge (Large)
```
Size: w-20 h-20 text-4xl (lg), w-12 h-12 text-2xl (md), w-8 h-8 text-base (sm)
Style: rounded-2xl border-2 flex items-center justify-center font-bold
Colors: Per grade mapping (Section 2.5)
```

#### Severity Pill
```
Style: text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border
Colors: Per severity mapping (Section 2.6)
```

#### PRO Badge
```
Inline: text-[9px] font-bold text-indigo-400 bg-indigo-500/20 px-1 py-0.5 rounded
Full:   text-xs font-bold text-indigo-400 bg-indigo-500/20 px-2 py-1 rounded-full
```

---

## 6. Layout & Spacing

### 6.1 Page Structure

```
Body: bg-base text-slate-50 font-sans
Root: h-screen flex flex-col overflow-hidden
Header: glass-heavy, fixed height
Main: flex-1 flex overflow-hidden
Sidebar: glass-heavy, w-72 (desktop), full overlay (mobile)
Content: flex-1 flex flex-col min-w-0
```

### 6.2 Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `gap-1` / `p-1` | 4px | Tight inline elements |
| `gap-1.5` | 6px | Tab groups, badge spacing |
| `gap-2` / `p-2` | 8px | Standard inline gaps |
| `gap-3` / `p-3` | 12px | Card content padding |
| `gap-4` / `p-4` | 16px | Section padding, card padding |
| `gap-6` / `p-6` | 24px | Modal padding, section spacing |
| `mb-4` | 16px | Between form fields |
| `mb-6` | 24px | Between sections |

### 6.3 Border Radius Scale

| Class | Value | Usage |
|-------|-------|-------|
| `rounded-lg` | 8px | Inputs, small cards, buttons |
| `rounded-xl` | 12px | Cards, modals, textarea |
| `rounded-2xl` | 16px | Large accent elements, splash buttons |
| `rounded-full` | 9999px | Pills, badges, status dots |

### 6.4 Z-Index Scale

| Layer | Value | Usage |
|-------|-------|-------|
| `z-10` | 10 | Floating elements within content |
| `z-20` | 20 | Sidebar, panels |
| `z-30` | 30 | Sticky headers |
| `z-40` | 40 | Tooltips, dropdowns |
| `z-50` | 50 | Modals, overlays, toasts |

### 6.5 Responsive Breakpoints

| Prefix | Min Width | Usage |
|--------|-----------|-------|
| (none) | 0px | Mobile-first base |
| `sm:` | 640px | Small tablets |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Desktop |
| `xl:` | 1280px | Large desktop |

**Key responsive patterns:**
- Mode tabs: `text-xs sm:text-sm`, `px-2 sm:px-3`, `gap-1.5 sm:gap-2`
- Sidebar: Full overlay on mobile, fixed panel on desktop
- Content padding: `px-3 sm:px-4`

---

## 7. Animations & Transitions

### 7.1 Micro-Interactions

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| Color transitions | 200ms | ease | Hover states, tab switches |
| Fade in | 300ms | ease-out | New elements, messages |
| Button press | instant | — | `translateY(0)` on `:active` |
| Button hover lift | 200ms | ease | `translateY(-1px)` on `:hover` |

### 7.2 Ambient Animations

| Animation | Duration | Usage |
|-----------|----------|-------|
| `glow-pulse` | 3s infinite | Status dots, active indicators |
| `border-glow` | 3s infinite | Focused inputs, active elements |
| `shimmer` | 3s linear infinite | Loading states |
| `pulse-dot` | 1.4s infinite | Typing indicator dots |

### 7.3 Transition Classes

```
Default:     transition-colors (color changes only)
All props:   transition-all (size, position, color)
Transform:   transition-transform (movement only)
Duration:    200ms default (Tailwind default)
```

### 7.4 Accessibility

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

## 8. Icons

### 8.1 Icon Library

**Primary:** Lucide React (`lucide-react` v0.577.0)

**Standard Size:** `w-4 h-4` (16px) for inline, `w-5 h-5` (20px) for toolbar

### 8.2 Commonly Used Icons

| Category | Icons |
|----------|-------|
| Navigation | `ChevronLeft`, `ChevronRight`, `PanelLeft`, `X` |
| Actions | `Plus`, `Download`, `Upload`, `Copy`, `Save`, `Trash`, `Edit` |
| Status | `CheckCircle`, `AlertCircle`, `AlertTriangle`, `Wifi`, `WifiOff` |
| Content | `FileText`, `FolderOpen`, `BookOpen`, `History`, `Settings` |
| Modes | `MessageCircle`, `Lightbulb`, `Bug`, `Sparkles`, `Wrench`, `Shield` |

### 8.3 Mode Tab Icons

Mode tabs currently use **emoji icons** for a friendly, approachable feel:

| Mode | Icon | Tier |
|------|------|------|
| Chat | `\ud83d\udcac` | Free |
| Explain This | `\ud83d\udca1` | Free |
| Safety Check | `\ud83d\udc1b` | Free |
| Clean Up | `\u2728` | Free |
| Code to Plain English | `\ud83d\udccb` | Free |
| Idea to Code Spec | `\ud83d\udd27` | Free |
| Review | `\ud83d\udcdd` | Free |
| Prompting | `\ud83c\udfaf` | Free |
| Skillz | `\u26a1` | Pro |
| Agentic | `\ud83e\udd16` | Pro |
| Create | `\ud83d\udee0\ufe0f` | Free |

> **Design Note:** Emojis are used deliberately for mode tabs to maintain the friendly "vibe coder" personality. All other UI elements use Lucide SVG icons.

---

## 9. 3D & Visual Effects

### 9.1 Three.js Particles

| Component | Purpose | Props |
|-----------|---------|-------|
| `ParticleField` | Ambient floating particles | `particleCount`, `speed`, `color` |
| `FloatingGeometry` | Animated 3D shapes in header | `shapeCount` |
| `ParticleBurst` | Send button feedback | `trigger` |

### 9.2 Spline Scenes

| Component | Purpose |
|-----------|---------|
| `SplashScreen` | Full-screen intro with 3D scene |
| `HeaderScene` | Dynamic header visual |
| `EmptyStateScene` | Mode-specific empty states |

### 9.3 Status Indicators

| Component | Purpose | Props |
|-----------|---------|-------|
| `OrbitingBadge` | Connection status | `status: streaming/online/offline` |
| `TokenCounter` | Holographic token/duration display | Stats data |
| `TypingIndicator3D` | 3D loading dots | — |

### 9.4 Performance

- Particle count adjusts for mobile devices
- Spline scenes lazy-load with error boundaries
- All 3D components respect `prefers-reduced-motion`

---

## 10. Accessibility

### 10.1 Focus States

```css
*:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
  border-radius: 4px;
}
```

### 10.2 ARIA Patterns

| Pattern | Implementation |
|---------|---------------|
| Modals | `role="dialog"`, `aria-modal="true"`, `aria-label` |
| Toasts | `role="status"`, `aria-live="polite"` |
| Icon buttons | `aria-label="descriptive text"` |
| Tabs | Click handlers with visual active state |
| Skip link | `.skip-link` class, hidden until focused |

### 10.3 Color Contrast

- Body text (`slate-200` on `base`): exceeds 4.5:1
- Secondary text (`slate-400` on `base`): exceeds 4.5:1
- Accent text (`indigo-300` on `base`): exceeds 4.5:1
- Never use color alone as the only indicator

### 10.4 Scrollbar

```css
.scrollbar-thin::-webkit-scrollbar { width: 6px; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
.scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #64748b; }
```

---

## 11. Technical Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Build | Vite | 7.3.1 |
| CSS | Tailwind CSS | v4.2.1 |
| UI Framework | React | 18 |
| Icons | Lucide React | 0.577.0 |
| 3D | Three.js / Spline | Latest |
| Fonts | Google Fonts (Inter, JetBrains Mono) | — |

### CSS Architecture

Tailwind v4 with `@import "tailwindcss"` and `@theme` block for custom properties. All custom utility classes defined in `src/index.css` using standard CSS (not `@apply`).

---

## 12. Quick Reference Card

### Do

- Use `.glass` / `.glass-heavy` / `.glass-neon` for all surfaces
- Use `.btn-neon` for primary CTAs
- Use `.input-glow` for all form inputs
- Use `text-slate-{200-400}` for text hierarchy
- Use indigo (`#6366f1`) as the primary accent
- Use Lucide icons at `w-4 h-4` for UI elements
- Use `rounded-lg` for inputs, `rounded-xl` for cards, `rounded-2xl` for accents
- Use `transition-colors` for hover states (200ms)
- Use opacity modifiers (`/20`, `/30`, `/40`) for layered depth
- Respect `prefers-reduced-motion`

### Don't

- Don't use flat backgrounds without glass blur
- Don't use colors outside the established palette
- Don't mix icon libraries (stick to Lucide)
- Don't use `transition-all` when `transition-colors` suffices
- Don't add new z-index values outside the scale (10, 20, 30, 40, 50)
- Don't use light mode styles (dark-only app)
- Don't use animations longer than 300ms for micro-interactions
- Don't use text smaller than `text-xs` (12px) except badges
