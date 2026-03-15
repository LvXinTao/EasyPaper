# Floating Chat Dialog Design

## Overview

Replace the current Q&A tab in the analysis panel with an independent floating chat dialog, triggered by a fixed pill button in the bottom-right corner of the paper detail page.

## Motivation

The Q&A chat is currently embedded as the last tab in the section tabs alongside analysis content (Summary, Contributions, etc.). This forces users to switch away from analysis to chat, losing context. A floating dialog allows users to chat with AI while keeping the analysis panel visible.

## Design

### Components

**1. ChatButton**

A fixed-position pill button in the bottom-right corner of the paper detail page.

- Position: `fixed`, bottom 20px, right 20px
- Style: Indigo background, white text, rounded pill shape (border-radius 20px)
- Two states:
  - **Closed**: Chat icon + "Ask AI" text
  - **Open**: X icon + "Close" text
- Shadow: `0 4px 16px rgba(99,102,241,0.4)`
- Height: 40px
- z-index: 50
- Clicking toggles the chat dialog open/closed

**2. ChatDialog**

A floating panel that appears above the pill button.

- Position: `fixed`, bottom 64px, right 20px
- Size: 380px wide, 480px tall
- Border-radius: 16px
- Shadow: `0 12px 40px rgba(0,0,0,0.15)`
- z-index: 50
- Structure (top to bottom):
  - **Drag handle**: Centered 36px bar, decorative only (no drag resize in v1)
  - **Header**: Chat icon in indigo background square + "Ask AI" title + "About this paper" subtitle + close button (X)
  - **Messages area**: Scrollable, flex-grow. Reuses existing `ChatMessages` component
  - **Input area**: Border-top separator. Reuses existing `ChatInput` component
- Animation:
  - Open: slide up 12px + fade in, 200ms ease-out
  - Close: slide down 12px + fade out, 150ms ease-in

**3. State lifting**

Chat-related state currently lives in `AnalysisPanel`. It must be lifted to `PaperDetailPage`:

- `chatMessages: ChatMessage[]`
- `streamingContent: string`
- `isChatStreaming: boolean`
- `handleSendMessage(message: string): void`

`AnalysisPanel` stops managing chat state entirely. `ChatDialog` receives these as props.

### Changes to Existing Components

**section-tabs.tsx**
- Remove the `{ key: 'chat', label: 'Q&A' }` entry from `SECTIONS`

**analysis-panel.tsx**
- Remove `ChatInput` and `ChatMessages` imports
- Remove all chat state (`chatMessages`, `streamingContent`, `isChatStreaming`, `handleSendMessage`)
- Remove the `activeSection === 'chat'` branch in the render
- Remove `initialChatMessages` from `AnalysisPanelProps` interface
- Remove `paperId` from props (no longer needed without chat)
- The component becomes a pure analysis display panel

**paper/[id]/page.tsx**
- Add chat state and `handleSendMessage` logic (moved from `AnalysisPanel`)
- Pass `initialChatMessages` to `ChatDialog` instead of `AnalysisPanel`
- Render `ChatButton` and `ChatDialog` as siblings alongside the existing layout
- Pass `paperId`, chat state, and send handler to `ChatDialog`

### New Files

- `src/components/chat-button.tsx` — The pill FAB button
- `src/components/chat-dialog.tsx` — The floating dialog container (composes `ChatMessages` + `ChatInput`)

### Unchanged Files

- `src/components/chat-input.tsx` — Reused as-is
- `src/components/chat-messages.tsx` — Reused as-is
- `src/hooks/use-typewriter.ts` — Reused as-is

## Edge Cases

- **Small screens**: Dialog uses `max-height: calc(100vh - 100px)` and `max-width: calc(100vw - 40px)` to avoid overflow
- **Chat history persistence**: Existing behavior preserved — `initialChatMessages` loaded from server, new messages accumulated in state
- **Multiple open/close**: Chat messages and streaming state persist across open/close toggles within the same page session
- **Streaming while closed**: If the user closes the dialog while a response is streaming, the fetch continues in the background. Reopening the dialog shows the accumulated response.

## Keyboard Accessibility

- Pressing `Escape` while the dialog is open closes it
- When dialog opens, focus moves to the chat input field
- When dialog closes, focus returns to the ChatButton
