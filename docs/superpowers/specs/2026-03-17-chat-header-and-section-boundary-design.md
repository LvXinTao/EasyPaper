# AI Chat Header & Section Boundary Design

## Overview

Two UI improvements for the paper detail page's right panel:
1. Replace the plain "AI Chat" text label with an icon + text header
2. Improve visual separation between Analysis and Chat sections

## Current State

- AI Chat header is a plain `text-xs font-semibold` label ("AI Chat") with a model badge
- Analysis and Chat sections are separated only by a thin 6px `ResizableDivider` with a `var(--border)` colored line
- The two sections visually blend together, making it hard to distinguish where Analysis ends and Chat begins

## Design

### 1. AI Chat Header — Robot Icon + Gradient Badge

- **Icon container**: 24x24px, border-radius 8px, background `linear-gradient(135deg, #6366f1, #8b5cf6)`
- **Icon SVG** (14x14px, viewBox `0 0 24 24`, stroke white, stroke-width 2, fill none):
  ```svg
  <rect x="3" y="11" width="18" height="10" rx="2"/>
  <circle cx="12" cy="5" r="2"/>
  <path d="M12 7v4"/>
  <line x1="8" y1="16" x2="8" y2="16"/>
  <line x1="16" y1="16" x2="16" y2="16"/>
  ```
- **Label**: "AI Chat" text, 13px, font-weight 600, positioned to the right of the icon with 8px gap
- **Model badge**: Remains unchanged (glass background, green dot, model name)
- **Layout**: Flex row, `align-items: center`, `justify-content: space-between`
- **Colors**: The gradient uses hardcoded indigo/violet values (`#6366f1`, `#8b5cf6`) as accent branding, consistent across themes

### 2. Section Boundary — Shared Card Container + Gradient Divider

- **Implementation approach**: Add a new wrapper `div` inside the existing right panel container (the flex column at ~line 325 of `page.tsx`) that wraps the Analysis section, the ResizableDivider, and the Chat section together. The existing right panel's `overflow-hidden` and flex layout remain unchanged.
- **Wrapper styles**:
  - `border-radius: 12px`
  - `border: 1px solid var(--glass-border)`
  - `overflow: hidden`
  - `display: flex; flex-direction: column; flex: 1`
- **Analysis section**: Removes its own border-radius, inherits top corners from wrapper
- **Chat section**: Removes its own border-radius, inherits bottom corners from wrapper
- **Gradient divider**: Modify the existing `ResizableDivider`'s inner visible indicator (the 3px bar) to use gradient background instead of `var(--border)`:
  - `background: linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1)`
  - `opacity: 0.6`
  - No additional DOM elements needed — just restyle the existing divider's inner bar
- **Colors**: Same hardcoded indigo/violet palette as the chat icon, used as accent branding

## Affected Files

- `src/app/paper/[id]/page.tsx` — all changes happen here:
  - Chat header redesign (the "AI Chat" label + model badge is defined at ~lines 397-408)
  - Right panel layout: add shared card wrapper around Analysis + Divider + Chat
  - Restyle ResizableDivider's inner bar to gradient

## Scope

- No changes to chat functionality, message rendering, or input behavior
- No changes to Analysis panel content or tab behavior
- Only visual/layout changes to the right panel structure and chat header
