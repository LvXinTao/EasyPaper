# EasyPaper UI Redesign — Design Spec

**Date:** 2026-03-17
**Status:** Draft
**Scope:** Home page, Paper detail page, Navbar, Upload flow, Theme system

---

## 1. Design Direction

### Visual Language
- **Color system:** Low-saturation, dark-mode-first palette. Three-level gray text hierarchy (`--text-primary: #e8e8ec`, `--text-secondary: #8b8b9e`, `--text-tertiary: #55556a`). Background at `#161618`. No bright accent colors — interactions conveyed through subtle white-alpha shifts.
- **Glass texture:** All cards, panels, and interactive surfaces use `backdrop-filter: blur` with `rgba(255,255,255, 0.04)` backgrounds and `rgba(255,255,255, 0.08)` borders. Light themes use inverted glass values (`rgba(0,0,0, 0.04)` backgrounds, `rgba(0,0,0, 0.06)` borders) to remain visible on white.
- **Spacing & radius:** Consistent 7–10px border-radius for interactive elements, 10–14px for cards/panels. 12–16px padding standard.
- **Typography:** System font stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`). Title: 16px/700, body: 13px, secondary body: 12px, labels: 10–11px uppercase with letter-spacing. Minimum font size: 10px (labels only).

### CSS Variable Architecture
All colors are driven by CSS custom properties on `:root`, enabling theme switching:

```
--bg, --bg-deep, --surface, --surface-hover
--border, --border-strong
--text-primary, --text-secondary, --text-tertiary
--accent, --accent-subtle
--glass, --glass-border
--green, --green-subtle (status: analyzed/success)
--amber, --amber-subtle (status: pending/warning)
--blue, --blue-subtle (status: parsing-analyzing/info)
--rose, --rose-subtle (status: error/danger)
```

---

## 2. Home Page

### Layout: Three-column
Full viewport height below navbar (`h-[calc(100vh-44px)]`).

**Column 1 — Folder Sidebar (200px, fixed)**
- Sections: "Library" (All Papers) and "Folders" (user-created, supports nesting)
- Each item: colored dot + name + paper count
- Active state: accent-subtle background with accent text + subtle border
- Bottom: "+ New folder" button (dashed border)
- Collapsible nested folders with indentation (padding-left)

**Column 2 — Paper List (300px, fixed)**
- Header: title ("All Papers") + count
- Search bar: glass-style input with search icon
- Filter chips: "All", "Analyzed", "Pending", "Error" — mapped to existing `PaperStatus` values (`analyzed`, `pending | parsing | analyzing`, `error`). Pill-shaped, active chip uses inverted colors (white bg, dark text).
- Paper rows: title (13px/600), subtitle (authors + year), tags (mini pills) + status indicator
- Active row: accent-subtle background with subtle border
- Scrollable with overflow-y auto. If performance degrades with large paper counts (100+), add virtualization using `@tanstack/react-virtual` (fixed row height ~72px).

**Column 3 — Preview Panel (flex: 1, fills remaining)**
- Shown when a paper is selected in Column 2
- Header: paper title (16px/700) + meta (authors, venue, year)
- Action buttons: "Open" (primary), "Analyze", "⋯" (more menu with: Move to folder, Delete)
- Tags row
- Stats row: 4 glass cards showing Sections / Notes / Chats / Pages counts
- Summary and Key Contributions sections in glass cards
- Empty state (no selection): centered icon + "Select a paper to preview"

### Upload Flow
- **Entry point:** "+ Upload" button in the navbar (primary style). Also accessible via keyboard shortcut.
- **Also supports:** dragging a PDF file onto the paper list area (Column 2)
- **Modal:** glass-blur overlay + centered upload dialog (420px wide)
  - Drag & drop zone with dashed border
  - "or click to browse" hint
  - Progress animation during upload
  - Cancel button
  - On success: close modal, add paper to list, select it in Column 2
- **Empty library state:** Column 2 shows centered upload prompt when no papers exist

---

## 3. Paper Detail Page

### Top Bar
- Back button (← icon, glass style) — returns to home
- Paper title (truncated with ellipsis)
- Status badge ("✓ Analyzed" in green-subtle)
- Action buttons: "Re-analyze"

### Layout: PDF + Right Panel (resizable)
Split view with a **draggable vertical divider** between PDF and right panel. Default ratio ~55/45.

**Resizable Panel Behavior:**
- Vertical divider (left-right): min PDF width 300px, min right panel width 280px. Default 55/45 split.
- Horizontal divider (top-bottom in right panel): min top zone 150px, min bottom zone 120px. Default 55/45 split.
- Drag handles: 6px wide/tall, subtle bar indicator, cursor changes to `col-resize` / `row-resize`.
- Panel ratios persist in `localStorage` per paper ID, restored on next visit. Falls back to default if no saved ratio.
- Keyboard: when divider is focused (via Tab), arrow keys adjust by 20px increments.

**Left — PDF Viewer**
- Toolbar: prev/next page, page indicator (editable), zoom controls, fullscreen toggle
- Canvas area: dark background (#1a1a1e), centered white PDF page with shadow
- Text layer overlay for selection
- Progress bar at bottom for page navigation
- Maintains existing keyboard shortcuts (arrow keys, Page Up/Down)

**Right — Split Panel (resizable vertically)**
Two zones separated by a **draggable horizontal divider**:

**Top Zone — Analysis / Notes (Tab switch)**
- Tab bar with two tabs: "Analysis" (with section count badge) and "Notes" (with note count badge)
- Active tab: accent underline indicator
- **Analysis view:** Glass cards for each section (Summary, Key Contributions, Methodology, Experiments, Conclusions). Each card has an uppercase label + body text.
- **Notes view:** List of note items, each in a glass card with title, type tag (important/question/todo/idea/summary — colored), page reference, and relative time (based on `updatedAt`, e.g. "2 hours ago"). "+ New note" button at bottom.
- Separate views, not mixed — clear visual and functional boundary

**Bottom Zone — AI Chat (fixed)**
- Header: "AI Chat" label + **model badge** (green dot + model name like "GPT-4o", displayed in a glass pill). Model name read from `config/settings.json` AI_MODEL field.
- Messages: user messages (accent-subtle, right-aligned, bottom-right radius reduced) and AI messages (glass, left-aligned, bottom-left radius reduced)
- Streaming indicator: three-dot bounce animation
- Input bar: glass input field + send button (solid primary style)

---

## 4. Navbar (Global)

Replaces current indigo-violet gradient navbar. **New height: 44px** (reduced from previous 52px — all `calc(100vh - 52px)` references must update to 44px).

- Background: `rgba(255,255,255, 0.02)` with `backdrop-filter: blur(16px)`, bottom border
- Left: "EasyPaper" logo (14px/700, white)
- Right: "+ Upload" button (primary), "Settings" button (glass)
- On paper detail page: back button replaces logo, paper title shown inline

---

## 5. Theme Customization

### Settings Page — Appearance Section
- **Preset themes:** 3-4 built-in options. Each preset defines a full set of CSS variable values.
  - Dark Minimal (current default — low-saturation dark)
  - Light Minimal (white bg `#fafafa`, dark text, inverted glass values: `rgba(0,0,0, 0.04)` backgrounds, `rgba(0,0,0, 0.06)` borders)
  - Deep Blue (darker, blue-shifted background)
  - Warm Dark (slightly amber-shifted neutrals)
- **Custom accent color:** color picker for `--accent` variable, which cascades to `--accent-subtle` (auto-computed at 10% opacity)
- **Storage:** theme preference saved in `config/settings.json` alongside existing API settings
- **Implementation:** CSS Variables on `<html>` element, theme class toggles variable sets.
- **Persistence strategy:** Store theme preset name in both `config/settings.json` (server-side, source of truth) and `localStorage` (client-side, fast access). On page load, a small inline `<script>` in `layout.tsx` reads `localStorage` and applies the theme class to `<html>` before React hydration, preventing flash of unstyled content. On first visit or cleared localStorage, the default Dark Minimal theme applies.

---

## 6. Components Affected

### New Components
| Component | Purpose |
|-----------|---------|
| `src/components/resizable-divider.tsx` | Draggable divider for split panels (horizontal and vertical modes). Handles mouse/touch drag, keyboard arrows, min/max constraints, and localStorage persistence. |
| `src/components/paper-row.tsx` | List-item component for Column 2 paper list. Replaces card layout with compact row: title, subtitle, tags, status indicator. |
| `src/components/preview-panel.tsx` | Column 3 of home page. Displays selected paper's summary, stats, tags, and action buttons. |
| `src/components/upload-modal.tsx` | Modal dialog for uploading PDFs. Glass-blur overlay, drag/drop zone, progress indicator. Replaces inline upload-zone on home page. |
| `src/components/theme-picker.tsx` | Appearance section in Settings. Preset theme selector + custom accent color picker. |

### Modified Components (major changes)
| Component | Change |
|-----------|--------|
| `src/app/page.tsx` | Replace single-column with three-column layout |
| `src/app/paper/[id]/page.tsx` | Resizable split panels, integrated chat, new top bar |
| `src/app/layout.tsx` | Add inline theme script, update navbar height |
| `src/components/navbar.tsx` | New design, upload button, remove gradient, 44px height |
| `src/components/analysis-panel.tsx` | Glass card styling, part of tab-switched view |
| `src/components/chat-dialog.tsx` | Integrated into right panel bottom zone (not floating) |
| `src/components/chat-messages.tsx` | Restyle to glass theme |
| `src/components/chat-input.tsx` | Restyle to glass theme |
| `src/components/notes-panel.tsx` | Restyle, placed under Notes tab |
| `src/components/notes-list.tsx` | Restyle to glass cards, show relative time from `updatedAt` |
| `src/components/note-editor.tsx` | Restyle to match new design |
| `src/components/pdf-viewer.tsx` | Restyle toolbar, keep core rendering logic |
| `src/components/section-tabs.tsx` | Restyle to new tab bar design |
| `src/components/folder-tree.tsx` | Restyle and integrate into home page Col 1 |
| `src/components/settings-form.tsx` | Add Appearance section with theme picker |
| `src/app/globals.css` | Add CSS Variables for all themes, glass utility classes, new animations |

### Removed Components
| Component | Reason |
|-----------|--------|
| `chat-button.tsx` | Chat integrated into detail page panel |
| `paper-drawer.tsx` | Replaced by home page folder sidebar |
| `upload-zone.tsx` | Replaced by `upload-modal.tsx` |
| `paper-card.tsx` | Replaced by `paper-row.tsx` |

---

## 7. Data Changes

### `config/settings.json`
Add theme field:
```json
{
  "theme": {
    "preset": "dark-minimal",
    "customAccent": null
  }
}
```

### `src/types/index.ts`
Add theme types:
```typescript
type ThemePreset = 'dark-minimal' | 'light-minimal' | 'deep-blue' | 'warm-dark';
interface ThemeSettings {
  preset: ThemePreset;
  customAccent: string | null; // hex color or null
}
```

### API Changes
- `GET/PUT /api/settings` — extend to include `theme` field in settings payload (existing endpoint, expanded payload)

### No changes to:
- Paper storage structure (`data/papers/`)
- Paper metadata schema
- AI client, prompts, or chat/analysis API routes
- `PaperStatus` type (filter chips map to existing statuses)

---

## 8. Non-Goals (out of scope)

- Mobile responsive layout (desktop-first for now)
- Dark/light mode auto-detection (manual toggle only)
- PDF annotation tools
- Collaborative features
- Paper import from URLs or DOIs
- Export/download features (future)
- Favorites / To Read smart filters (future — would require `PaperMetadata` extension)
- User authentication / avatar system
