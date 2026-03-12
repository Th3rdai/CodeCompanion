# Spline 3D Integration Guide

A step-by-step guide for adding interactive 3D scenes to Th3rdAI Code Companion.


## What is Spline?

Spline is a **free, web-based 3D design tool**. You create 3D objects (shapes, text, abstract forms), animate them, and export them as interactive components you can embed in any web app. No coding required — it's all drag-and-drop.

Your Code Companion app is already wired up to display Spline scenes in **three locations**. You just need to create the scenes and paste the URLs.


## Quick Start (5 Steps)

### Step 1: Create a Spline Account

Go to [spline.design](https://spline.design) and sign up. The free tier gives you everything you need.

### Step 2: Create a New Project

Click **"New File"** from the Spline dashboard. You'll see a 3D canvas with a default cube.

### Step 3: Design Your Scene

Use the toolbar to add objects, lights, and effects:

- **Shapes:** Cube, sphere, torus, cylinder, etc.
- **Text:** 3D text with your brand name or tagline
- **Materials:** Apply colors (use your brand palette — see below)
- **Animations:** Rotate, float, pulse, morph on loop
- **Lighting:** Ambient + directional for depth

**Brand Colors to Use:**
| Color    | Hex       | Where to Use                 |
|----------|-----------|------------------------------|
| Blue     | `#3B82F6` | Primary objects, glow effects|
| Indigo   | `#6366F1` | Accent shapes, highlights    |
| Purple   | `#8B5CF6` | Secondary accents, gradients |
| Cyan     | `#38BDF8` | Light sources, rim lighting  |
| Dark BG  | `#0C0F1A` | Scene background color       |

### Step 4: Get the Scene URL

1. Click the **Share** button (top-right)
2. Select **"Public Link"** or **"Embed"**
3. Copy the URL — it looks like:
   ```
   https://prod.spline.design/ABC123xyz/scene.splinecode
   ```

### Step 5: Add to Code Companion

Open the `.env` file in your project root and paste the URL:

```env
VITE_SPLINE_SPLASH_SCENE=https://prod.spline.design/ABC123xyz/scene.splinecode
```

Save the file and refresh your browser. The 3D scene appears!


## Scene Locations

Your app has three spots ready for 3D scenes:

### 1. Splash Screen (`VITE_SPLINE_SPLASH_SCENE`)

**What:** Full-screen hero shown when the app first opens. Auto-dismisses after 5 seconds or when clicked.

**Design tips:**
- Go bold — this is the first thing users see
- Works well with: spinning logo, glowing orb, abstract tech shapes, floating particles
- Scene can be complex (5-10MB is fine since it only loads once per session)
- Set the background color to `#0C0F1A` to blend with the app

### 2. Header Background (`VITE_SPLINE_HEADER_SCENE`)

**What:** Subtle ambient 3D behind the top navigation bar. Visible through the glass effect.

**Design tips:**
- Keep it **very subtle** — buttons and text sit on top of this
- Works well with: slow-moving particles, soft gradient blobs, gentle wave motion
- Keep it small (under 2MB) since it's always visible
- Use low opacity objects so it doesn't compete with the UI

### 3. Chat Empty State (`VITE_SPLINE_EMPTY_STATE_SCENE`)

**What:** Appears alongside the mode description when no messages are in the chat.

**Design tips:**
- Medium complexity — fills a card-sized area (not full screen)
- Works well with: floating code brackets, 3D chat bubble, abstract brain, AI-themed shapes
- 2-5MB is a good size range
- Should feel inviting, encouraging users to start chatting


## Troubleshooting

### "My scene isn't showing up"
1. Check the URL starts with `https://prod.spline.design/`
2. Make sure you clicked **Share** → **Public** (not just the edit link)
3. Hard-refresh your browser: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)
4. Check the `.env` file has no extra spaces around the URL

### "The scene loads slowly"
- Simplify the scene (fewer objects, simpler materials)
- Reduce texture resolution in Spline
- The app shows a loading spinner while the scene downloads

### "The scene doesn't look right on mobile"
- Test in Spline's preview mode on a phone
- Simpler scenes perform better on mobile
- The app shows a gradient fallback if the scene can't load

### "I want to change a scene later"
- Update the URL in `.env`
- Save and refresh — instant swap, no code changes needed

### "I want to disable 3D scenes"
- Delete the URLs from `.env` (leave them blank)
- The app gracefully falls back to gradient backgrounds


## Tips for Great Scenes

1. **Match the dark theme** — Set your Spline background to `#0C0F1A`
2. **Use brand colors** — Blue, indigo, purple gradients look amazing
3. **Add subtle animation** — Slow rotation or floating is better than fast motion
4. **Keep it loopable** — Scenes play on repeat, so avoid abrupt starts/stops
5. **Test performance** — If it lags, reduce polygon count or remove shadows
6. **Less is more** — A single well-lit glowing orb beats a cluttered scene


## Community Resources

- [Spline Community Gallery](https://spline.design/community) — Free scenes you can remix
- [Spline YouTube Tutorials](https://www.youtube.com/@spaboratory) — Official tutorials
- [Spline Docs](https://docs.spline.design) — Full reference documentation
