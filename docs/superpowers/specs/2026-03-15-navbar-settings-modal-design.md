# Navbar Layout & Settings Modal

## Overview

Two changes to the app shell: (1) move navbar items to screen edges, (2) replace settings page navigation with an in-page modal dialog.

## Motivation

The current navbar uses `max-w-7xl mx-auto`, centering "EasyPaper" and "Settings" away from the viewport edges. The settings page requires a full navigation away from the current context. Both feel disconnected from the content.

## Design

### 1. Navbar Edge Alignment

Remove `max-w-7xl mx-auto` from the navbar's inner container. Use `px-4` padding only, so "EasyPaper" sits at the left edge and "Settings" at the right edge.

No other visual changes to the navbar.

### 2. Settings Modal

**Trigger:** The "Settings" navbar item becomes a `<button>` instead of `<a href="/settings">`.

**Backdrop:** `fixed inset-0 bg-black/50 z-50`. Not clickable to close (prevents accidental dismissal while editing settings).

**Card:** Centered (`flex items-center justify-center`), `max-w-xl w-full mx-4`, white background, `rounded-2xl`, shadow, padding. Matches the existing settings page card style.

**Header:** "API Settings" title on the left, X close button on the right.

**Content:** Renders the existing `<SettingsForm />` component unchanged.

**Close:** Only via the X button in the top-right corner of the card. No backdrop click, no Escape key.

**Animation:** Fade in/out, 150ms ease-out on both backdrop and card.

### 3. Architecture

Since `layout.tsx` is a Server Component, extract a `'use client'` `<Navbar />` component that owns the `isSettingsOpen` state and renders both the navbar and the modal.

## Changes to Existing Files

### `src/app/layout.tsx`

Replace the inline `<nav>` with `<Navbar />` import.

### New: `src/components/navbar.tsx`

Client component containing:
- The full navbar markup (moved from layout.tsx)
- `isSettingsOpen` state
- Settings modal with backdrop, card, close button
- `<SettingsForm />` rendered inside the modal

### `src/app/settings/page.tsx`

Keep as-is for direct URL access. No changes.

## Edge Cases

- **Settings form save feedback:** The success/error message from `SettingsForm` displays inside the modal as it currently does on the page. No change needed.
- **Scroll lock:** When modal is open, prevent body scroll with `overflow: hidden` on body.
- **Multiple modals:** Not applicable — only one modal exists.
