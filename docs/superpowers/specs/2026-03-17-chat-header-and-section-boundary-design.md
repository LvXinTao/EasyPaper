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
- **Icon**: White robot SVG (14x14px) — body rectangle, antenna circle, antenna line
- **Label**: "AI Chat" text, 13px, font-weight 600, positioned to the right of the icon with 8px gap
- **Model badge**: Remains unchanged (glass background, green dot, model name)
- **Layout**: Flex row, `align-items: center`, `justify-content: space-between`

### 2. Section Boundary — Shared Card Container + Gradient Divider

- **Outer container**: Both Analysis and Chat wrapped in a shared card container with:
  - `border-radius: 12px`
  - `border: 1px solid var(--glass-border)`
  - `overflow: hidden`
- **Analysis section**: Occupies top portion, `border-radius: 12px 12px 0 0` (top corners only)
- **Chat section**: Occupies bottom portion, `border-radius: 0 0 12px 12px` (bottom corners only)
- **Gradient divider**: 3px height between sections
  - `background: linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1)`
  - `opacity: 0.6`
- **Resizable divider**: Overlaid on top of the gradient line, maintaining drag functionality

## Affected Files

- `src/app/paper/[id]/page.tsx` — right panel layout, wrapping Analysis + Chat in shared card container, adding gradient divider
- `src/components/chat-messages.tsx` — chat header redesign (icon + text)

## Scope

- No changes to chat functionality, message rendering, or input behavior
- No changes to Analysis panel content or tab behavior
- Only visual/layout changes to the right panel structure and chat header
