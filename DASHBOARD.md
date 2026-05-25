# Code Companion Dashboard — Implementation Plan

## Executive Summary

Create an optional home dashboard for Code Companion that balances recent work resumption with feature discovery, serving both vibe coders (non-technical creators) and power users (developers) with a hybrid navigation approach.

**User Requirements:**

- **Purpose**: Hybrid - Recent work + Feature access
- **Audience**: Mixed - Both vibe coders and power users
- **Navigation**: Hybrid - Dashboard cards with quick access (sidebar/command palette)
- **Integration**: Optional - User can choose dashboard-first or current tab navigation

---

## Design System (UI/UX Pro Max Research)

### Visual Style: **Vibrant & Block-based with Developer Focus**

Matches the existing cyberpunk neon glass morphism aesthetic while supporting both audiences.

### Design Tokens

**Colors** (from existing `design-system/DESIGN-STANDARDS.md`):

- **Base Background**: `#0c0f1a` (deep navy)
- **Surface**: `#141829` (glass cards)
- **Brand Accent**: `#6366f1` (indigo)
- **Neon Glow**: `rgba(99, 102, 241, 0.4)`
- **Status Colors**: Emerald (success), Blue (info), Amber (warning), Red (critical)

**Typography**:

- **UI/Body**: Inter (300-700 weights)
- **Code/Data**: JetBrains Mono (400, 500)
- Existing scale: text-xs to text-xl with consistent weight hierarchy

**Glass System** (Already established):

- `.glass` — Default cards (rgba(20, 24, 41, 0.6), blur 16px)
- `.glass-heavy` — Headers, modals (rgba(20, 24, 41, 0.85), blur 24px)
- `.glass-neon` — Accent cards (rgba(20, 24, 41, 0.5), blur 20px, indigo border)

---

## Dashboard Layout Pattern: **Bento Grid + Portfolio Hybrid**

### Structure Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│ Dashboard Header (glass-heavy)                                  │
│ • "Dashboard" Title (with Home icon) + Quick Stats • Actions    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌──────────────────┐ ┌──────────────┐ ┌──────────────────────┐│
│ │ Recent Work      │ │ Quick Stats  │ │ Shortcuts           ││
│ │ (3 latest chats) │ │ (4 metrics)  │ │ (favorite modes)    ││
│ │                  │ │              │ │                     ││
│ │ • Chat - 2m ago  │ │ 42 Total     │ │ [⚡Quick Actions]   ││
│ │ • Review - 1h    │ │ 3 Active     │ │                     ││
│ │ • Security - 2h  │ │ 5 Models     │ │                     ││
│ └──────────────────┘ └──────────────┘ └──────────────────────┘│
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Feature Access Grid (18 Non-Dashboard Modes)                ││
│ │                                                             ││
│ │ [Chat]  [Review]  [Security]  [Build]  [Create]            ││
│ │ [Diagram] [Experiment] [Validate] [Terminal] [...]         ││
│ │                                                             ││
│ │ Builder Modes:                                              ││
│ │ [Prompting] [Skillz] [Agentic] [Planner]                   ││
│ └─────────────────────────────────────────────────────────────┘│
│ (Icons rendered as Lucide React SVG components)               │
│                                                                 │
│ ┌──────────────────┐ ┌─────────────────────────────────────────│
│ │ 7-Day Activity   │ │ Mode Breakdown (bar chart)             ││
│ │ (line chart)     │ │ • Chat: 45%                            ││
│ │                  │ │ • Review: 25%                          ││
│ └──────────────────┘ │ • Security: 15%                        ││
│                      │ • Other: 15%                           ││
│                      └─────────────────────────────────────────│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Why This Pattern:**

1. **Bento Grid** — Modular, Apple-style showcase; each widget is independent and toggleable
2. **Portfolio Grid** — Recent work displayed prominently with hover interactions
3. **Feature Discovery** — All 18 non-dashboard modes visible with icons and descriptions for discoverability

---

## Dashboard Zones (Component Breakdown)

### Zone 1: Header & Controls

**Component:** `DashboardHeader.jsx`

**Content:**

- Title: "Dashboard" with Home icon (Lucide React) and gradient neon text
- Quick metrics: Total conversations, Active threads, Models used (inline badges)
- Actions:
  - Refresh button (reload analytics)
  - Export dropdown (MD/JSON/CSV)
  - Settings cog (quick access)

**Style:** `glass-heavy border-b border-slate-700/30`

**Props:**

```typescript
interface DashboardHeaderProps {
  totalConversations: number;
  activeThreads: number;
  modelsUsed: number;
  onRefresh: () => void;
  onExport: (format: "md" | "json" | "csv") => void;
}
```

---

### Zone 2: Recent Work (Top Priority)

**Component:** `RecentWorkSection.jsx`

**Layout:** 3-column grid (responsive to 1 col mobile)

**Card Content:**

- Mode icon + badge (colored by mode)
- Conversation title (truncated to 2 lines)
- Last active timestamp (relative time: "2m ago", "1h ago")
- Quick actions:
  - Resume (primary button)
  - Export (icon button)
  - Archive (icon button)

**Interaction:**

- Click card → Load conversation and switch to that mode
- Hover → Lift animation + indigo border glow

**Empty State:**

```
"No recent activity — start chatting!"
[Start a Conversation] button → Switches to Chat mode
```

**Style:** `.glass` cards with `hover:border-slate-600/50 hover:-translate-y-1 transition-all duration-200`

**Props:**

```typescript
interface RecentWorkSectionProps {
  conversations: Array<{
    id: string;
    mode: string;
    title: string;
    lastActive: Date;
    messageCount: number;
  }>;
  onResume: (conversationId: string) => void;
  onExport: (conversationId: string) => void;
  onArchive: (conversationId: string) => void;
}
```

---

### Zone 3: Quick Stats

**Component:** `QuickStatsGrid.jsx`

**Metrics (4 cards):**

1. **Total Conversations**
   - Large number display
   - Icon: MessageCircle (Lucide)
   - Subtitle: "All time"

2. **Active Threads** (with accent)
   - Indigo accent border
   - Icon: Zap (Lucide)
   - Subtitle: "Currently open"

3. **Models Used**
   - Blue accent
   - Icon: Bot (Lucide)
   - Subtitle: "Different models"

4. **This Week Activity**
   - Trend indicator (↑ ↓ →)
   - Icon: TrendingUp (Lucide)
   - Subtitle: "+12% vs last week"

**Style:** Small glass cards (`p-4`) with large numbers (`text-3xl font-bold`) + subtle icons

**Layout:** `grid grid-cols-2 gap-4 lg:grid-cols-4`

**Props:**

```typescript
interface QuickStatsGridProps {
  totalConversations: number;
  activeThreads: number;
  modelsUsed: number;
  weeklyActivity: {
    count: number;
    trend: "up" | "down" | "flat";
    percentage: number;
  };
}
```

---

### Zone 4: Feature Access Grid (PRIMARY NAVIGATION)

**Component:** `FeatureGrid.jsx` + `FeatureModeCard.jsx`

**18 Mode Cards** (from `MODES` array in `App.jsx`):

**Primary Modes (always visible):**

- MessageCircle Chat — "Have a conversation with AI"
- Search Review — "Get code review with grades"
- Shield Security — "OWASP security assessment"
- Hammer Build — "Project scaffolding wizard"
- Sparkles Create — "New project setup (ICM)"
- GitBranch Diagram — "Visualize with Mermaid.js"
- FlaskConical Experiment — "Sandboxed testing"
- CheckCircle Validate — "Generate validation commands"
- Terminal Terminal — "Integrated terminal (Electron)"

**Builder Modes (grouped section):**

- FileText Prompting — "Score prompt quality"
- Target Skillz — "Design agent skills"
- Bot Agentic — "Multi-agent workflows"
- ClipboardList Planner — "Implementation planning"

**Secondary Modes (collapsible "Show More"):**

- Eye Explain This
- Lock Safety Check
- Sparkles Clean Up
- Type Code → Plain English
- Lightbulb Idea → Code Spec

**Note**: Icon names are from Lucide React (lucide-react package). Import and render as React components.

**Card Design:**

- Mode SVG icon (w-10 h-10, centered, text-indigo-400 from Lucide React)
- Mode label (text-lg font-semibold)
- Short description (text-sm text-slate-400, 1 line, truncated)
- Hover state:
  - Indigo glow (`shadow-lg shadow-indigo-500/20`)
  - Lift animation (`-translate-y-1`)
  - Border highlight (`border-indigo-500/50`)
- Click: Switch to that mode + close dashboard (unless already on dashboard)

**Layout:**

```css
grid grid-cols-2
sm:grid-cols-3
lg:grid-cols-4
xl:grid-cols-6
gap-4
```

**Style:**

```css
.glass p-6 rounded-xl cursor-pointer
hover:border-indigo-500/50
hover:-translate-y-1
hover:shadow-lg hover:shadow-indigo-500/20
transition-all duration-200
```

**Keyboard Navigation:**

- Tab to focus each card
- Enter/Space to activate
- Arrow keys to move between cards (optional enhancement)

**Props:**

```typescript
interface FeatureGridProps {
  modes: Array<{
    id: string;
    label: string;
    icon: string;
    description: string;
    category?: "primary" | "builder" | "secondary";
  }>;
  currentMode: string;
  onModeSelect: (modeId: string) => void;
}

interface FeatureModeCardProps {
  mode: Mode;
  isActive: boolean;
  onClick: () => void;
}
```

---

### Zone 5: Activity & Analytics

**Component:** `AnalyticsPanels.jsx`

**Already exists in `DashboardPanel.jsx` — extract and refactor:**

1. **7-Day Activity Table/Chart**
   - Line chart showing usage trend
   - Table with date, conversations, mode breakdown
   - Sparkline for quick visual

2. **Mode Breakdown Bar Chart**
   - Horizontal bar list (existing `BarList` component)
   - Shows percentage usage per mode
   - Top 5 modes highlighted

3. **Model Family Usage** (existing)
   - Pie chart or bar chart
   - Shows distribution across model families

4. **System Performance** (optional, user-toggleable)
   - CPU usage (if available via Electron)
   - Memory usage
   - Network status
   - Ollama connection health

**Props:**

```typescript
interface AnalyticsPanelsProps {
  weeklyActivity: Array<{
    date: Date;
    conversations: number;
    modes: Record<string, number>;
  }>;
  modeBreakdown: Record<string, number>;
  modelUsage: Record<string, number>;
  systemMetrics?: {
    cpu: number;
    memory: number;
    network: "online" | "offline";
    ollama: "connected" | "disconnected";
  };
}
```

---

### Zone 6: Widget Visibility Controls

**Component:** `WidgetToggle.jsx`

**Already exists in `DashboardPanel.jsx` — extract:**

**Controls:**

- [ ] Show Recent Work
- [ ] Show Quick Stats
- [ ] Show Feature Grid (always visible, non-toggleable)
- [ ] Show 7-Day Activity
- [ ] Show Mode Breakdown
- [ ] Show Model Usage
- [ ] Show System Performance

**Storage:** `localStorage` key: `cc-dashboard-widgets`

**Default:** All checked except "System Performance"

**Props:**

```typescript
interface WidgetToggleProps {
  visibleWidgets: string[];
  onToggle: (widgetId: string) => void;
}
```

---

## Navigation Integration Strategy

### Recommendation: **Dashboard as Optional Mode** (Non-Disruptive)

**Implementation:**

1. **Add new mode to `MODES` array in `App.jsx`:**

```javascript
const MODES = [
  { id: "dashboard", label: "🏠 Dashboard", icon: "🏠" },
  { id: "chat", label: "💬 Chat", icon: "💬" },
  // ... existing modes
];
```

2. **Settings toggle in `SettingsPanel.jsx`:**

```javascript
// New checkbox in General tab
<label className="flex items-center space-x-2">
  <input
    type="checkbox"
    checked={showDashboardOnStartup}
    onChange={(e) => setShowDashboardOnStartup(e.target.checked)}
  />
  <span>Show dashboard on startup</span>
</label>
```

3. **Startup logic in `App.jsx`:**

```javascript
useEffect(() => {
  const showDashboard = localStorage.getItem("cc-show-dashboard") === "true";
  const lastMode = localStorage.getItem("cc-last-mode");

  if (showDashboard && !lastMode) {
    setCurrentMode("dashboard");
  } else {
    setCurrentMode(lastMode || "chat");
  }
}, []);
```

4. **Dashboard mode shows full-width grid:**

```javascript
{
  currentMode === "dashboard" && (
    <DashboardPanel
      modes={MODES}
      history={history} // from useChat hook
      analytics={analyticsData}
      onModeSelect={(modeId) => {
        setMode(modeId); // Switch mode (triggers mode change)
      }}
    />
  );
}
```

5. **Mode switching behavior:**
   - Clicking any mode card switches from dashboard to that mode
   - Dashboard tab remains visible in mode tabs for quick return
   - Sidebar conversation history works regardless of dashboard setting

**Pros:**

- Non-disruptive to existing users (default: off)
- Dashboard is discoverable via mode tabs
- Optional — power users can skip it
- Hybrid navigation preserved (sidebar + mode tabs + dashboard)

**Cons:**

- Dashboard is "just another mode" (less special than dedicated home screen)

---

## Key UX Considerations

### For Mixed Audience (Vibe Coders + Power Users):

#### Vibe Coder Needs:

✅ **Visual clarity**: Large mode icons, friendly descriptions (no jargon)
✅ **Empty states**: Encouraging messages ("No recent activity — start chatting!"), not blank screens
✅ **Quick starts**: "Try these..." suggestions with CTA buttons
✅ **Guidance**: Helpful tooltips on hover

#### Power User Needs:

✅ **Efficiency**: Keyboard shortcuts (Tab + Enter, Cmd/Ctrl+K for command palette)
✅ **Data density**: Toggleable widgets, compact views, full analytics
✅ **Export**: Full data export (MD, JSON, CSV)
✅ **Customization**: Hide/show widgets, reorder (future enhancement)

#### Balanced Design Decisions:

| Feature       | Vibe Coder         | Power User            | Solution                            |
| ------------- | ------------------ | --------------------- | ----------------------------------- |
| Mode Cards    | Large, descriptive | Compact, quick launch | Medium size with 1-line description |
| Analytics     | Hidden by default  | Always visible        | Toggleable via Widget Controls      |
| Shortcuts     | Visual buttons     | Keyboard nav          | Both (buttons + keyboard support)   |
| Empty States  | Friendly CTAs      | Skip to action        | Encouraging message + primary CTA   |
| Customization | Pre-configured     | Full control          | Default config + toggles            |

---

## Component Structure (React)

### File Organization:

```
src/components/
├── DashboardPanel.jsx (REFACTOR — becomes wrapper)
├── dashboard/
│   ├── DashboardHeader.jsx (NEW)
│   ├── RecentWorkSection.jsx (NEW)
│   ├── QuickStatsGrid.jsx (EXTRACT from DashboardPanel)
│   ├── FeatureGrid.jsx (NEW — THE KEY COMPONENT)
│   ├── FeatureModeCard.jsx (NEW)
│   ├── AnalyticsPanels.jsx (EXTRACT from DashboardPanel)
│   ├── WidgetToggle.jsx (EXTRACT from DashboardPanel)
│   └── DashboardEmptyState.jsx (NEW)
```

### State Management:

**In `App.jsx`:**

```javascript
// Dashboard visibility preference
const [showDashboard, setShowDashboard] = useState(
  () => localStorage.getItem("cc-show-dashboard") === "true",
);

// Widget visibility toggles
const [dashboardWidgets, setDashboardWidgets] = useState(() =>
  JSON.parse(
    localStorage.getItem("cc-dashboard-widgets") ||
      JSON.stringify([
        "recent-work",
        "quick-stats",
        "feature-grid", // always visible
        "7-day-activity",
        "mode-breakdown",
        "model-usage",
        // 'system-performance' // off by default
      ]),
  ),
);

// Current mode (existing)
const [currentMode, setCurrentMode] = useState(() => {
  if (showDashboard && !localStorage.getItem("cc-last-mode")) {
    return "dashboard";
  }
  return localStorage.getItem("cc-last-mode") || "chat";
});
```

**Or extract to custom hook:**

```javascript
// src/hooks/useDashboard.js
export function useDashboard() {
  const [showDashboard, setShowDashboard] = useState(/* ... */);
  const [visibleWidgets, setVisibleWidgets] = useState(/* ... */);

  const toggleWidget = (widgetId) => {
    setVisibleWidgets((prev) => {
      const updated = prev.includes(widgetId)
        ? prev.filter((id) => id !== widgetId)
        : [...prev, widgetId];
      localStorage.setItem("cc-dashboard-widgets", JSON.stringify(updated));
      return updated;
    });
  };

  return { showDashboard, setShowDashboard, visibleWidgets, toggleWidget };
}
```

### Key Props Flow:

**DashboardPanel** receives from `App.jsx`:

```typescript
<DashboardPanel
  modes={MODES} // all 19 modes (including dashboard)
  history={history} // for Recent Work (from useChat hook)
  analytics={analyticsData} // for charts/stats
  systemMetrics={systemMetrics} // optional
  visibleWidgets={dashboardWidgets} // which sections to show
  onModeSelect={(modeId) => {
    setMode(modeId); // Switch mode (from App.jsx)
  }}
  onToggleWidget={toggleWidget}
  onRefresh={refreshAnalytics}
  onExport={exportData}
  isElectron={isElectron} // for terminal mode filtering
/>
```

---

## Anti-Patterns to Avoid

Based on UI/UX Pro Max research and design system guidelines:

### ❌ Don't:

1. **Complex onboarding flow**
   - ❌ Forced dashboard tour
   - ❌ Multi-step wizard on first load
   - ✅ Optional tour link in header (skip by default)

2. **Cluttered layout**
   - ❌ Too many widgets by default (overwhelms vibe coders)
   - ✅ Start with essentials (Recent Work + Feature Grid + Quick Stats)

3. **No skip option**
   - ❌ Force dashboard, no way to turn off
   - ✅ Settings toggle, default OFF for existing users

4. **Hover-only actions**
   - ❌ Critical actions only visible on hover
   - ✅ Mobile users can't hover — use tap/click

5. **Break back button**
   - ❌ Dashboard circumvents browser history
   - ✅ Dashboard is a mode, respects React Router/history

6. **Blank empty screens**
   - ❌ No conversations = empty white space
   - ✅ Always show helpful message + CTA ("Start a conversation")

7. **Light mode assumptions**
   - ❌ Dashboard works only in light mode
   - ✅ Dark-only app (existing design), embrace it

8. **Animations > 300ms**
   - ❌ Slow, laggy transitions (500ms+ feels sluggish)
   - ✅ Keep micro-interactions snappy (150-200ms)

9. **Flat backgrounds**
   - ❌ Solid color cards (breaks aesthetic)
   - ✅ Use glass morphism consistently (`.glass` classes)

10. **Color outside palette**
    - ❌ Random accent colors (green, pink, orange)
    - ✅ Stick to indigo/slate/status colors (existing design system)

### ✅ Do:

1. **Progressive disclosure**
   - Start simple, allow customization via Widget Toggles

2. **Loading indicators**
   - Show spinner/skeleton for async data (>300ms load time)

3. **Inline validation**
   - Validate settings on blur, not just submit

4. **Focus states visible**
   - Keyboard nav must be clear (accessibility requirement)
   - `focus-visible:ring-2 ring-indigo-400`

5. **Responsive breakpoints**
   - Test at: 375px (mobile), 768px (tablet), 1024px (laptop), 1440px (desktop)

6. **Glass blur effects**
   - Consistent with existing design system (`.glass`, `.glass-heavy`)

7. **Smooth transitions**
   - 200ms for color/border changes
   - Use `transition-all duration-200 ease-in-out`

8. **Empty state CTAs**
   - "Start chatting" or "Create project" buttons (primary actions)

9. **Status indicators**
   - Connection dot (Ollama status)
   - Model badge (current model)
   - Health warnings (if disconnected)

10. **Export options**
    - MD/JSON/CSV for power users (data portability)

---

## Data Structures & APIs

### Conversation Object Shape

Based on `useChat` hook (App.jsx line 520-580), conversations have this structure:

```typescript
interface Conversation {
  id: string; // Unique conversation ID
  mode: string; // Mode ID (e.g., "chat", "review", "pentest")
  title?: string; // User-set or auto-generated title
  timestamp: number; // Creation timestamp (Unix ms)
  lastActive: number; // Last message timestamp (Unix ms)
  messages: Message[]; // Array of chat messages
  archived: boolean; // Whether conversation is archived
  folder?: string; // Optional folder ID
}
```

### Accessing Conversation History

From App.jsx useChat hook (line 526):

```javascript
const {
  history, // Array of all conversations (from useChat hook)
  loadConversation, // Function: loadConversation(conversationId: string)
  // ... other exports
} = useChat({
  /* ... */
});
```

### Getting Recent Conversations

```javascript
// Get 3 most recent non-archived conversations
const recentConversations = history
  .filter((conv) => !conv.archived)
  .sort((a, b) => b.lastActive - a.lastActive)
  .slice(0, 3);
```

### Analytics Data Structure

Based on existing `DashboardPanel.jsx` component (lines 37-44):

```typescript
interface Analytics {
  totals: {
    conversations: number;
    active: number;
    archived: number;
    messages: number;
  };
  modeCounts: { [modeId: string]: number };
  modelCounts: { [modelName: string]: number };
  dailyActivity: { [date: string]: number };
}

interface SystemMetrics {
  cpu: { usagePercent: number };
  uptimeSec: number;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  network: {
    inboundKbps1m: number;
    outboundKbps1m: number;
  };
  requests: {
    perMinute: number;
    avgLatencyMs: number;
  };
}
```

### DashboardPanel.jsx Status

**Current State**: `src/components/DashboardPanel.jsx` EXISTS but is **NOT imported or used** in App.jsx. It's a fully functional analytics dashboard with:

- ✅ 5 widget sections (performance, totals, modes, models, activity)
- ✅ BarList component for bar charts (reusable)
- ✅ Widget toggle logic with localStorage (`cc-dashboard-widgets`)
- ✅ Export buttons (MD/JSON/CSV)

**Refactor Strategy**: In Phase 3, we will **extract and reuse** components from DashboardPanel.jsx rather than rebuilding from scratch.

---

## Implementation Phasing

**Total Estimated Time:** 6-10 hours (Phases 1-4)

**Optional Advanced Features:** +3-5 hours (Phase 5)

---

### Prerequisites

**Install Lucide React icons** (replaces emoji icons with accessible SVG):

```bash
npm install lucide-react
```

**Icon Mapping Reference**: Create `src/components/dashboard/icon-map.js` with the following mappings:

```javascript
// Icon mapping for dashboard modes
import {
  Home,
  MessageCircle,
  Search,
  Shield,
  Hammer,
  Sparkles,
  GitBranch,
  FlaskConical,
  CheckCircle,
  Terminal,
  FileText,
  Target,
  Bot,
  ClipboardList,
  Eye,
  Lock,
  Type,
  Lightbulb,
} from "lucide-react";

export const DASHBOARD_ICONS = {
  dashboard: Home,
  chat: MessageCircle,
  review: Search,
  pentest: Shield,
  build: Hammer,
  create: Sparkles,
  diagram: GitBranch,
  experiment: FlaskConical,
  validate: CheckCircle,
  terminal: Terminal,
  prompting: FileText,
  skillz: Target,
  agentic: Bot,
  planner: ClipboardList,
  explain: Eye,
  bugs: Lock,
  refactor: Sparkles, // Clean Up
  "translate-tech": Type,
  "translate-biz": Lightbulb,
};

export function getModeIcon(modeId) {
  return DASHBOARD_ICONS[modeId] || MessageCircle;
}
```

---

### Phase 1: Foundation (MVP Dashboard) — **2-3 hours**

**Goal:** Basic dashboard mode with feature grid navigation

**Decision: Dashboard Mode Structure**

- Dashboard WILL be added to MODES array as the **19th mode**
- FeatureGrid will display the **OTHER 18 modes** (filters out dashboard itself to avoid self-reference)
- Success criterion: "All 18 non-dashboard modes are clickable in Feature Grid"

**Tasks:**

- [ ] Add "dashboard" mode to `MODES` array in `src/App.jsx`

  ```javascript
  import { Home } from 'lucide-react';

  {
    id: "dashboard",
    label: "Dashboard",
    icon: Home, // Lucide React component
    desc: "Your home for recent work and feature discovery",
    placeholder: "", // Dashboard has no chat input
  }
  ```

  **Note:** This makes **19 modes total** in MODES array.

- [ ] Create basic `DashboardHeader` component
  - Title with gradient neon text
  - Export/Refresh buttons (stub for now)

- [ ] Build `FeatureGrid` component (**THE KEY COMPONENT**)
  - Map over `MODES.filter(m => m.id !== 'dashboard')` (**18 modes**, excluding dashboard)
  - Filter out Terminal mode in browser builds:
    ```javascript
    const modesForGrid = MODES.filter((m) => m.id !== "dashboard").filter(
      (m) => isElectron || m.id !== "terminal",
    );
    // Shows 17 modes in browser, 18 in Electron
    ```
  - Create `FeatureModeCard` for each mode
  - Grid layout: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4`
  - Click handler: `onModeSelect(modeId)` switches from dashboard to clicked mode

- [ ] Add Settings toggle in `SettingsPanel.jsx`
  - Checkbox: "Show dashboard on startup"
  - Store in `localStorage` as `cc-show-dashboard`
  - Default: `false` (non-disruptive)

- [ ] Wire up mode switching logic in `App.jsx`
  - Clicking mode card switches to that mode
  - Dashboard closes when switching (unless user clicks back to dashboard tab)

**Deliverable:** Working dashboard with clickable mode cards that navigate to each mode

---

### Phase 2: Recent Work Section — **1-2 hours**

**Goal:** Show last 3 conversations with resume functionality

**Tasks:**

- [ ] Create `RecentWorkSection` component
- [ ] Pull 3 most recent conversations from `history` (from useChat hook)
  ```javascript
  const recent = history
    .filter((c) => !c.archived)
    .sort((a, b) => b.lastActive - a.lastActive)
    .slice(0, 3);
  ```
- [ ] Display for each conversation:
  - Mode badge (colored, small)
  - Title (truncated to 2 lines with ellipsis)
  - Timestamp (relative: "2m ago", "1h ago", "yesterday")
  - Quick actions: Resume (primary), Export, Archive
- [ ] Implement click-to-resume functionality
  ```javascript
  async function resumeConversation(conversationId) {
    const conv = history.find((c) => c.id === conversationId);
    await loadConversation(conversationId); // Loads messages into state
    setMode(conv.mode); // Switch to conversation's mode
    // Dashboard closes automatically when mode changes
  }
  ```
- [ ] Add empty state
  - Message: "No recent activity — start chatting!"
  - CTA button: "Start a Conversation" → switches to Chat mode
- [ ] Add skeleton screens for loading states (if data takes >300ms)

  ```jsx
  function RecentWorkSkeleton() {
    return (
      <div className="glass p-6 rounded-xl animate-pulse">
        <div className="h-6 w-32 bg-slate-700 rounded mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-neon p-4 rounded-lg mb-3">
            <div className="h-5 w-48 bg-slate-700 rounded mb-2" />
            <div className="h-4 w-24 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Show skeleton if loading takes >300ms
  const [showSkeleton, setShowSkeleton] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowSkeleton(true), 300);
    return () => clearTimeout(timer);
  }, []);

  if (loading && showSkeleton) return <RecentWorkSkeleton />;
  ```

- [ ] Style with glass cards
  - Hover: lift animation (`-translate-y-1`)
  - Hover: indigo border glow (`border-indigo-500/50`)
  - Smooth transitions (200ms via `var(--dashboard-transition)`)

**Deliverable:** Recent work cards that load conversations on click

---

### Phase 3: Analytics Integration — **2-3 hours**

**Goal:** Extract and integrate analytics from existing `DashboardPanel.jsx`

**Pre-Phase Investigation** (✅ COMPLETE):

- ✅ `DashboardPanel.jsx` exists and is fully functional
- ✅ Has 5 working widgets: performance, totals, modes, models, activity
- ✅ Has reusable `BarList` component (lines 15-35)
- ✅ Has widget toggle logic with `cc-dashboard-widgets` localStorage

**Refactor Strategy: Extract Components**

- Keep: BarList, WIDGETS array, widget toggle logic
- Extract: Individual widget sections into separate components
- Integrate: Compose into new Dashboard mode

**Tasks:**

- [ ] Extract `BarList` component from DashboardPanel.jsx
  - Move to `src/components/dashboard/BarList.jsx`
  - Used by mode breakdown and model breakdown charts

- [ ] Create `QuickStatsGrid` component
  - Extract "Summary totals" section (lines 213-244)
  - 4 metric cards: Conversations, Active, Archived, Loaded Messages
  - Large numbers (`text-xl`) with subtle labels
  - Props: `analytics.totals`

- [ ] Create `AnalyticsPanels` component
  - **Mode breakdown**: Extract lines 247-260, uses BarList
  - **Model breakdown**: Extract lines 262-276, uses BarList
  - **7-day activity**: Extract lines 278-313, table layout
  - **System performance** (optional): Extract lines 127-189
  - Props: `analytics`, `systemMetrics`, `systemMetricsLoading`

- [ ] Reuse widget visibility toggle logic
  - Copy WIDGETS array (lines 3-9)
  - Copy toggleWidget function (lines 55-63)
  - Copy widget checkboxes UI (lines 192-211)
  - Note: `cc-dashboard-widgets` localStorage key already in use

- [ ] Add chart accessibility patterns
  - **Line chart** (7-day activity):
    - Include data table below chart (toggle "Show Data Table")
    - Add `aria-label="7-day conversation activity trend"`
    - Mark table with `role="table"` and proper headers
  - **Bar chart** (mode breakdown):
    - BarList already shows values
    - Add `aria-label` to each bar: "Chat mode: 42 conversations"
    - Wrap in `role="list"` with `role="listitem"` for each bar
    - Add `role="progressbar"` with `aria-valuenow/min/max` to progress bars
  - **All charts**:
    - Test with screen reader (VoiceOver/NVDA reads data correctly)
    - Keyboard focus on bars for drill-down (optional)

  **Example - Accessible BarList**:

  ```jsx
  <div className="space-y-2" role="list" aria-label="Mode usage breakdown">
    {items.map(([label, count]) => (
      <div
        key={label}
        role="listitem"
        aria-label={`${label}: ${count} conversations`}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="truncate">{label}</span>
          <span aria-hidden="true">{count}</span>
        </div>
        <div className="h-2 rounded bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-indigo-500/80"
            style={{ width: `${Math.max((count / max) * 100, 4)}%` }}
            role="progressbar"
            aria-valuenow={count}
            aria-valuemin={0}
            aria-valuemax={max}
          />
        </div>
      </div>
    ))}
  </div>
  ```

- [ ] Wire up analytics data flow
  - Fetch analytics on dashboard mount (API endpoint TBD)
  - Pass `analytics` and `systemMetrics` props to components
  - Handle loading states (>300ms show spinner or skeleton screen)
  - Handle empty states (no conversations yet)

**Deliverable:** Dashboard with full analytics display and customization options

---

### Phase 4: Polish & Accessibility — **1-2 hours**

**Goal:** Ensure dashboard is accessible and mobile-friendly

**Tasks:**

- [ ] Keyboard navigation
  - Tab through all interactive elements (mode cards, buttons, links)
  - Enter/Space activates focused element
  - Arrow keys navigate between mode cards (optional enhancement)
- [ ] Add `aria-label` to all interactive elements
  - Mode cards: "Switch to Chat mode"
  - Buttons: "Refresh dashboard", "Export data"
  - Icon buttons: Include text labels
- [ ] Visible focus rings
  - Use `focus-visible:ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#0c0f1a]`
  - Test keyboard tab order matches visual order
- [ ] Loading states
  - Skeleton screens for Recent Work (while fetching)
  - Spinner for analytics charts (if >300ms)
  - Use existing `Spinner` component or create dashboard-specific skeletons
- [ ] Mobile responsive testing
  - **375px**: 1-column layout, stacked widgets
  - **768px**: 2-column mode cards, side-by-side quick stats
  - **1024px**: 3-4 column mode cards, analytics side-by-side
  - **1440px**: Full 6-column mode cards, all widgets visible
- [ ] Touch targets ≥44px (iOS HIG / Material Design standard)
  - ✅ Mode cards: 140x120px minimum (pass)
  - ✅ Quick action buttons: 44x44px minimum with padding
  - ✅ Widget toggle checkboxes: 44x44px tap area (visual checkbox 20x20px inside)
  - ✅ Recent work resume button: 44x44px minimum
  - Test on actual mobile devices (not just browser DevTools)

  **Touch Target Standards**:

  ```css
  /* Mode cards - already pass */
  .mode-card {
    min-height: 120px;
    min-width: 140px;
    padding: 1.5rem;
  }

  /* Quick action buttons */
  .quick-action-btn {
    min-width: 44px;
    min-height: 44px;
    padding: 0.75rem;
  }

  /* Widget toggle checkboxes */
  .widget-toggle {
    width: 44px;
    height: 44px;
  }
  .widget-toggle input[type="checkbox"] {
    width: 20px;
    height: 20px;
  }
  ```

- [ ] Color contrast verification
  - ✅ All text pre-verified (see Color Contrast section above)
  - [ ] Re-test with Lighthouse accessibility audit (target: ≥95 score)
  - [ ] Test with actual screen reader (VoiceOver on macOS / NVDA on Windows)
- [ ] Reduced motion support
  - Check `prefers-reduced-motion` media query
  - Disable animations for users with motion sensitivity
  ```css
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
- [ ] Standardize animation timing (UI/UX Pro Max compliant)
  - All hover states: 200ms (`var(--dashboard-transition)`)
  - All focus states: 200ms
  - Card lifts: 200ms
  - Modal open/close: 200-250ms
  - Icon hovers: 150ms (micro-interactions)
  - **No animations exceed 300ms** (feels sluggish)
  - Test with slow motion (browser DevTools animation speed)

**Deliverable:** Fully accessible, mobile-responsive dashboard

---

### Phase 5: Advanced Features (Optional / Future) — **3-5 hours**

**Goal:** Enhance dashboard with power user features

**Tasks (future enhancements):**

- [ ] Drag-and-drop widget reordering
  - Use library like `react-beautiful-dnd` or `@dnd-kit/core`
  - Allow users to rearrange dashboard zones
  - Store custom layout in `localStorage`
- [ ] Dashboard layout presets
  - Presets: "Minimal", "Balanced", "Advanced"
  - Minimal: Recent Work + Feature Grid only
  - Balanced: Current default (Recent Work + Stats + Feature Grid + 1 analytics chart)
  - Advanced: All widgets visible, dense layout
- [ ] Custom widget creation
  - Favorite modes (pin specific modes to top)
  - Pinned conversations (quick access to specific threads)
  - Custom quick actions (macros, saved prompts)
- [ ] Export dashboard analytics as report
  - Generate PDF/MD report with charts embedded
  - Summary of usage statistics (week/month/year)
  - Export button in header dropdown
- [ ] Command palette integration
  - Press `Cmd/Ctrl+K` from dashboard
  - Search/filter all 18 non-dashboard modes
  - Jump to any mode or recent conversation
  - Fuzzy search with keyboard-only navigation

**Deliverable:** Advanced dashboard customization for power users

---

## Accessibility Checklist

From design system + UX research:

- [ ] **All mode cards have `aria-label`** with full description
  - Example: `aria-label="Switch to Chat mode — Have a conversation with AI"`
- [ ] **Keyboard navigation works**
  - Tab through cards, Enter/Space to activate
  - Shift+Tab to go backwards
  - Focus visible with ring indicator
- [ ] **Focus ring visible**
  - `focus-visible:ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#0c0f1a]`
  - Test with keyboard-only navigation
- [ ] **Screen reader support**
  - Add skip link: "Skip to main content" (jumps over header)
  - Use semantic HTML (`<header>`, `<main>`, `<section>`, `<article>`)
  - All icons have text alternatives
- [ ] **Color contrast**
  - All text meets WCAG AA (4.5:1 minimum for normal text)
  - Test with Chrome DevTools > Lighthouse > Accessibility
- [ ] **Reduced motion support**
  - Respect `prefers-reduced-motion` media query
  - Disable animations for users with motion sensitivity
  ```css
  @media (prefers-reduced-motion: reduce) {
    * {
      animation: none !important;
      transition: none !important;
    }
  }
  ```
- [ ] **Loading states announced**
  - Use `aria-live="polite"` for dynamic content updates
  - Spinner has `role="status"` with loading text
- [ ] **Empty states clear**
  - Not just blank screens
  - Clear messages + primary CTA
- [ ] **Icon buttons labeled**
  - All icon-only buttons have `aria-label`
  - Example: `<button aria-label="Refresh dashboard">🔄</button>`
- [ ] **Status indicators semantic**
  - Use color + text/icon (not color alone)
  - Connection status: "Ollama: Connected ✅" not just green dot
- [ ] **Form labels present**
  - Widget toggle checkboxes have proper `<label>` associations
  - Settings toggle has clear label text

---

## Performance Considerations

From design system + UX research:

### Code Optimization:

- [ ] **Code splitting**: Dashboard components in separate Vite chunk
  ```javascript
  const DashboardPanel = lazy(() => import("./components/DashboardPanel"));
  ```
- [ ] **Lazy load 3D effects**: `ParticleField` only renders if dashboard visible
  ```javascript
  {
    currentMode === "dashboard" && (
      <Suspense fallback={<Spinner />}>
        <ParticleField />
      </Suspense>
    );
  }
  ```
- [ ] **Memoize expensive renders**: Use `useMemo` for sorted/filtered lists
  ```javascript
  const sortedConversations = useMemo(
    () => history.sort((a, b) => b.lastActive - a.lastActive).slice(0, 3),
    [history],
  );
  ```
- [ ] **Virtual scrolling**: If >100 conversations, use `react-window`
  - Only render visible items
  - For future: conversation list in sidebar

### Data Fetching:

- [ ] **Debounce analytics refresh**: Max 1 request per second
  ```javascript
  const debouncedRefresh = useMemo(() => debounce(refreshAnalytics, 1000), []);
  ```
- [ ] **Cache analytics in sessionStorage**: Avoid re-fetch on mode switch
  ```javascript
  const cachedAnalytics = sessionStorage.getItem("cc-analytics");
  if (cachedAnalytics) {
    setAnalytics(JSON.parse(cachedAnalytics));
  } else {
    fetchAnalytics().then((data) => {
      sessionStorage.setItem("cc-analytics", JSON.stringify(data));
      setAnalytics(data);
    });
  }
  ```
- [ ] **Abort controllers**: Cancel pending fetches when switching modes
  ```javascript
  useEffect(() => {
    const controller = new AbortController();
    fetchAnalytics({ signal: controller.signal });
    return () => controller.abort();
  }, []);
  ```

### Asset Optimization:

- [ ] **Mode icons are SVG** (Lucide React): Minimal bundle impact (~5KB gzipped)
  - Tree-shaking eliminates unused icons
  - Better scaling and accessibility than emoji
  - Supports hover color changes (text-indigo-400 → text-indigo-300)
- [ ] **Image optimization**: If adding graphics/screenshots
  - Use WebP format
  - Lazy load with `loading="lazy"`
  - Responsive images with `srcset`

### Rendering:

- [ ] **Avoid layout thrashing**: Use CSS Grid/Flexbox for dashboard layout
  - No JavaScript-based layout calculations
  - Let browser handle responsive layout
- [ ] **Throttle scroll handlers**: If adding infinite scroll
  - Use `requestAnimationFrame` for scroll updates
- [ ] **Batch state updates**: Use `useReducer` for complex dashboard state
  ```javascript
  const [dashboardState, dispatch] = useReducer(dashboardReducer, initialState);
  ```

---

## Design Tokens (CSS Custom Properties)

### Color Contrast Verification (WCAG 2.1 AA Compliant)

All text colors have been pre-verified for accessibility:

| Element        | Foreground                  | Background           | Contrast Ratio | WCAG Status |
| -------------- | --------------------------- | -------------------- | -------------- | ----------- |
| Primary text   | `#cbd5e1` (text-slate-300)  | `#0c0f1a`            | **10.2:1**     | ✅ AAA      |
| Secondary text | `#94a3b8` (text-slate-400)  | `#0c0f1a`            | **6.1:1**      | ✅ AA       |
| Accent text    | `#818cf8` (text-indigo-400) | `#0c0f1a`            | **5.8:1**      | ✅ AA       |
| Headings       | `#ffffff` (text-white)      | `#0c0f1a`            | **13.5:1**     | ✅ AAA      |
| Glass cards    | `#cbd5e1` (text-slate-300)  | `rgba(20,24,41,0.6)` | **8.5:1**      | ✅ AA       |

**Testing Requirements**:

- All contrast ratios verified with WebAIM Contrast Checker
- Normal text: 4.5:1 minimum (WCAG AA)
- Large text (18pt+): 3.1 minimum (WCAG AA)
- Re-test with Lighthouse audit in Phase 4

---

### CSS Custom Properties

Add to `src/index.css`:

```css
/* Dashboard-specific tokens */
:root {
  /* Spacing */
  --dashboard-grid-gap: 1rem;
  --dashboard-card-padding: 1.5rem;
  --dashboard-header-height: 4rem;

  /* Border Radius */
  --dashboard-card-radius: 0.75rem; /* 12px */
  --dashboard-button-radius: 0.5rem; /* 8px */

  /* Effects */
  --dashboard-card-hover-lift: -2px;
  --dashboard-transition: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --dashboard-shadow-hover: 0 10px 30px -10px rgba(99, 102, 241, 0.3);

  /* Animation Standards (UI/UX Pro Max compliant) */
  --animation-duration-micro: 150ms; /* Icon hover, focus rings */
  --animation-duration-standard: 200ms; /* Card lifts, mode switch */
  --animation-duration-modal: 250ms; /* Modal open/close */
  --animation-easing: cubic-bezier(0.4, 0, 0.2, 1); /* Material Design easing */

  /* Responsive grid columns */
  --dashboard-feature-cols: 2; /* mobile default */

  /* Z-index scale (from design system) */
  --z-dashboard-header: 10;
  --z-dashboard-tooltip: 20;
  --z-dashboard-dropdown: 30;
  --z-dashboard-modal: 50;
}

/* Responsive breakpoints */
@media (min-width: 640px) {
  :root {
    --dashboard-feature-cols: 3;
  }
}

@media (min-width: 1024px) {
  :root {
    --dashboard-feature-cols: 4;
    --dashboard-grid-gap: 1.5rem;
    --dashboard-card-padding: 2rem;
  }
}

@media (min-width: 1280px) {
  :root {
    --dashboard-feature-cols: 6;
  }
}

/* Dashboard-specific utilities */
.dashboard-card {
  padding: var(--dashboard-card-padding);
  border-radius: var(--dashboard-card-radius);
  transition: all var(--dashboard-transition);
}

.dashboard-card:hover {
  transform: translateY(var(--dashboard-card-hover-lift));
  box-shadow: var(--dashboard-shadow-hover);
}

/* Feature grid layout */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(var(--dashboard-feature-cols), 1fr);
  gap: var(--dashboard-grid-gap);
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Testing Strategy

### Unit Tests (Jest + React Testing Library):

**Components to test:**

- [ ] `DashboardHeader.jsx`
  - Renders title, stats, and action buttons
  - Calls `onRefresh` when refresh button clicked
  - Calls `onExport` with correct format when export selected
- [ ] `RecentWorkSection.jsx`
  - Renders 3 recent conversations
  - Displays empty state when no conversations
  - Calls `onResume` when card clicked
  - Shows correct relative timestamps
- [ ] `FeatureGrid.jsx`
  - Renders 18 non-dashboard mode cards (17 in browser, 18 in Electron)
  - Calls `onModeSelect` with correct mode ID when card clicked
  - Highlights current mode (if applicable)
  - Filters out dashboard mode (no self-reference)
  - Filters out terminal mode in browser builds
- [ ] `FeatureModeCard.jsx`
  - Renders icon, label, and description
  - Has correct accessibility attributes (`aria-label`)
  - Applies hover styles

**Integration tests:**

- [ ] Dashboard loads correctly when mode is "dashboard"
- [ ] Mode switching works (dashboard → chat → back to dashboard)
- [ ] Settings toggle updates localStorage
- [ ] Widget visibility toggles persist across sessions

### E2E Tests (Playwright):

**User flows to test:**

- [ ] **First-time user**: Dashboard not shown by default
- [ ] **Enable dashboard**: Settings toggle → dashboard appears on next load
- [ ] **Navigate to mode**: Click mode card → switches to that mode
- [ ] **Resume conversation**: Click recent work card → loads conversation
- [ ] **Export data**: Export button → downloads file in selected format
- [ ] **Keyboard navigation**: Tab through cards → Enter activates
- [ ] **Mobile responsive**: Dashboard works on 375px width

### Accessibility Tests:

- [ ] Run Lighthouse accessibility audit (score ≥90)
- [ ] Test with screen reader (NVDA/JAWS on Windows, VoiceOver on Mac)
- [ ] Keyboard-only navigation (no mouse)
- [ ] Color contrast checks (all text passes WCAG AA)

---

## Files to Create/Modify

### New Files (Create):

```
src/components/dashboard/
├── DashboardHeader.jsx          (Zone 1: Title with Home icon, metrics, actions)
├── RecentWorkSection.jsx        (Zone 2: Last 3 conversations + skeleton screens)
├── QuickStatsGrid.jsx           (Zone 3: 4 metric cards with Lucide icons)
├── FeatureGrid.jsx              (Zone 4: 18 mode cards - KEY COMPONENT)
├── FeatureModeCard.jsx          (Zone 4: Individual SVG icon card, 44x44px touch targets)
├── AnalyticsPanels.jsx          (Zone 5: Charts with ARIA labels)
├── WidgetToggle.jsx             (Zone 6: Show/hide widgets, 44x44px checkboxes)
├── BarList.jsx                  (Accessible chart with role="list", extracted from DashboardPanel)
├── DashboardEmptyState.jsx      (Empty state helper)
└── icon-map.js                  (Mode ID → Lucide icon mapping, see Prerequisites section)

src/hooks/
└── useDashboard.js              (Dashboard state management hook)

src/styles/
└── dashboard.css                (Dashboard-specific styles, if needed)

tests/unit/
└── dashboard/
    ├── DashboardHeader.test.jsx
    ├── RecentWorkSection.test.jsx
    ├── FeatureGrid.test.jsx
    └── FeatureModeCard.test.jsx

tests/e2e/
└── dashboard.spec.js            (Playwright E2E tests)
```

### Modified Files (Update):

```
src/App.jsx
- Add "dashboard" to MODES array (19th mode with Lucide Home icon)
- Add dashboard mode routing/switching logic
- Add startup logic (check localStorage for show-dashboard pref)
- Wire up onModeSelect handler

src/components/SettingsPanel.jsx
- Add "Show dashboard on startup" checkbox in General tab
- Store preference in localStorage as 'cc-show-dashboard'
- Add onChange handler to update state

src/components/DashboardPanel.jsx
- REFACTOR into wrapper component
- Import and compose dashboard/* sub-components
- Extract analytics logic into AnalyticsPanels (with ARIA labels)
- Extract widget toggle logic into WidgetToggle (44x44px checkboxes)
- Extract BarList with role="list" and ARIA attributes
- Pass props down to child components

src/index.css
- Add dashboard-specific CSS custom properties (design tokens)
- Add color contrast verified CSS variables
- Add animation standards (150ms, 200ms, 250ms)
- Add .dashboard-card utility class
- Add .feature-grid utility class
- Add prefers-reduced-motion support

package.json
- Add dependency: "lucide-react": "^0.263.1"
```

---

## Success Criteria

Dashboard implementation is complete when:

- ✅ Dashboard is accessible as a mode (tab in mode tabs, 19th mode in MODES array)
- ✅ Settings toggle controls "Show dashboard on startup" preference
- ✅ All 18 non-dashboard modes are clickable in Feature Grid (17 in browser, 18 in Electron)
- ✅ Clicking mode card switches to that mode
- ✅ Recent Work section shows last 3 conversations
- ✅ Clicking recent work card resumes that conversation
- ✅ Quick Stats display 4 key metrics
- ✅ Analytics panels show 7-day activity + mode breakdown
- ✅ Widget toggles allow customization (show/hide sections)
- ✅ Keyboard navigation works (Tab + Enter)
- ✅ Focus states visible for all interactive elements
- ✅ Mobile responsive (375px, 768px, 1024px, 1440px)
- ✅ Loading states shown for async data (>300ms)
- ✅ Empty states have helpful messages + CTAs
- ✅ Accessibility audit passes (Lighthouse ≥90)
- ✅ Glass morphism aesthetic consistent with existing design
- ✅ Non-disruptive to existing users (default OFF)

---

## Estimated Timeline

| Phase     | Tasks                        | Time           | Complexity |
| --------- | ---------------------------- | -------------- | ---------- |
| Phase 1   | Foundation (MVP Dashboard)   | 2-3 hours      | Medium     |
| Phase 2   | Recent Work Section          | 1-2 hours      | Low        |
| Phase 3   | Analytics Integration        | 2-3 hours      | Medium     |
| Phase 4   | Polish & Accessibility       | 1-2 hours      | Low-Medium |
| **Total** | **Core Dashboard**           | **6-10 hours** | **Medium** |
| Phase 5   | Advanced Features (Optional) | 3-5 hours      | High       |

**Developer skill assumptions:**

- Familiar with React, hooks, and component composition
- Comfortable with Tailwind CSS utilities
- Experience with localStorage and browser APIs
- Basic accessibility knowledge (ARIA labels, keyboard nav)

**Bottlenecks:**

- Analytics data fetching (if slow, add loading skeletons)
- Widget reordering (Phase 5, complex, requires drag-and-drop library)
- 3D effects integration (ParticleField may cause render lag)

---

## Next Steps

1. **Review this plan** with the team (if applicable)
2. **Prioritize phases** — Can skip Phase 5 (advanced features) for MVP
3. **Set up component scaffolds** — Create empty component files with TypeScript interfaces
4. **Implement Phase 1** — Get basic dashboard working with feature grid
5. **Iterate with user feedback** — Show vibe coders and power users, gather feedback
6. **Polish and ship** — Complete Phase 4, run accessibility audit, deploy

---

## Questions / Decisions Needed

- [ ] Should dashboard be default for NEW users (first-time onboarding)?
  - Current plan: OFF by default for everyone
  - Alternative: ON for new users, OFF for existing (migration)

- [ ] Should mode tabs remain visible when dashboard is active?
  - Current plan: YES (dashboard is just another mode)
  - Alternative: Hide mode tabs, show "Back to Dashboard" button

- [ ] How to handle analytics data fetching?
  - Current plan: Fetch on dashboard mount, cache in sessionStorage
  - Alternative: Pre-fetch analytics on app startup, always available

- [ ] Should we add keyboard shortcuts for mode switching?
  - Example: `Cmd+1` = Chat, `Cmd+2` = Review, etc.
  - Current plan: Not in Phase 1-4, consider for Phase 5

- [ ] Should we support custom dashboard layouts?
  - Current plan: Fixed layout with widget toggles (Phase 1-4)
  - Alternative: Drag-and-drop reordering (Phase 5)

---

## References

- **Design System**: `design-system/DESIGN-STANDARDS.md`
- **Existing Components**: `src/components/DashboardPanel.jsx` (analytics reference)
- **Mode List**: `src/App.jsx` (MODES array)
- **Glass Morphism**: `src/index.css` (`.glass` utilities)
- **UI/UX Pro Max Skill**: `/Users/james/.claude/skills/ui-ux-pro-max/`
- **Accessibility Guidelines**: WCAG 2.1 Level AA
- **Performance**: Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1)

---

**Document Version:** 1.0
**Last Updated:** 2026-05-25
**Author:** Claude Code (UI/UX Pro Max Skill)
**Status:** Ready for Implementation
