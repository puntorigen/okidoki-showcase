# DocTranslate UI Improvements Plan

A comprehensive UI/UX overhaul to transform the translation example app into a polished, product-ready tool.

---

## Design Principles

1. **Flexibility first** - Never block user options; all paths always available
2. **Progressive enhancement** - Add helpful features without removing capabilities
3. **Contextual guidance** - Hints adapt to current state, not forced workflows
4. **Calm technology** - Animations inform, don't distract

---

## Current Components

| Component | Purpose | Status |
|-----------|---------|--------|
| `Header.tsx` | Logo, Upload, Download, Specialization | Exists - enhance |
| `TipBar.tsx` | Random tips at bottom | Exists - make contextual |
| `SummaryPanel.tsx` | Word count, sections list | Exists - add summary |
| `TranslationOverlay.tsx` | Progress during translation | Exists - simplify |
| `TranslationViewer.tsx` | DOCX editor wrapper | Exists - keep as is |

---

## Layout Overview

### Base Layout (Always Visible Editor)

The editor is **always visible and ready** - user can type immediately, upload a file, or use the AI assistant. No blocking empty states.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔵 DocTranslate              [Translate ▾] [Upload] [Download]     🌐 [?]  │
├─────────────────────────────────────────────────────┬───────────────────────┤
│                                                     │                       │
│  ┌───────────────────────────────────────────────┐  │  📄 Document          │
│  │                                               │  │  ─────────────────    │
│  │                                               │  │  🇺🇸 English          │
│  │                                               │  │  📝 0 words           │
│  │           [Editor always ready]               │  │                       │
│  │                                               │  │  ─────────────────    │
│  │    User can:                                  │  │                       │
│  │    • Just start typing                        │  │  📋 Summary           │
│  │    • Drop/upload a DOCX                       │  │  (appears when        │
│  │    • Ask AI to create something               │  │   content exists)     │
│  │                                               │  │                       │
│  │                                               │  │                       │
│  │                                               │  │                       │
│  └───────────────────────────────────────────────┘  │                       │
│                                                     │                       │
├─────────────────────────────────────────────────────┴───────────────────────┤
│  💡 Tip: Start typing, drop a DOCX file, or ask the assistant to help  💬   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key points:**
- Editor is always visible and interactive
- TipBar at bottom provides contextual guidance
- Sidebar shows document info (adapts to content)
- All three paths equally accessible

---

### With Document Content

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔵 DocTranslate              [Translate ▾] [Upload] [Download]     🌐 [?]  │
├─────────────────────────────────────────────────┬───────────────────────────┤
│                                                 │                           │
│  ┌───────────────────────────────────────────┐  │  📄 Document              │
│  │                                           │  │  ───────────────────────  │
│  │  CONSULTING AGREEMENT                     │  │                           │
│  │                                           │  │  🇺🇸 English (detected)   │
│  │  This Agreement is entered into as of...  │  │  📄 ~5 pages              │
│  │                                           │  │  📝 2,847 words           │
│  │  1. SERVICES                              │  │                           │
│  │  The Consultant agrees to provide...      │  │  ───────────────────────  │
│  │                                           │  │                           │
│  │  2. COMPENSATION                          │  │  📋 Summary               │
│  │  Client shall pay Consultant...           │  │                           │
│  │                                           │  │  A consulting services    │
│  │  3. TERM                                  │  │  agreement outlining      │
│  │  This Agreement shall commence...         │  │  scope of work, payment   │
│  │                                           │  │  terms, and mutual        │
│  │                                           │  │  confidentiality          │
│  │                                           │  │  obligations.             │
│  │                                           │  │                           │
│  │                                           │  │  ↻ Updated 5s ago         │
│  └───────────────────────────────────────────┘  │                           │
│                                                 │                           │
├─────────────────────────────────────────────────┴───────────────────────────┤
│  💡 Tip: Click "Translate" or ask the assistant for custom instructions  💬 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Header Enhancements:**
- Add "Translate ▾" dropdown (new)
- Keep existing Upload and Download buttons
- Keep language/specialization switchers

**Sidebar Enhancements:**
- Add detected language with flag (new)
- Add page count estimate (new)
- Keep word count
- Add executive summary with smart caching (new)
- Remove sections list (or make collapsible)

---

### During Translation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔵 DocTranslate              [Translating...] [Upload] [Download]  🌐 [?]  │
├─────────────────────────────────────────────────┬───────────────────────────┤
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░┌─────────────────────┐░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░│                     │░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░│    🇺🇸  →  🇪🇸       │░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░│                     │░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░│      ╭───────╮      │░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░│      │  45%  │      │░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░│      ╰───────╯      │░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░│                     │░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░│  Section 3 of 6     │░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░│  "Compensation"     │░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░│                     │░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░│      [Cancel]       │░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░│                     │░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░└─────────────────────┘░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │░░░░░░░░░░░░░░░░░░░░░░░░░░│
├─────────────────────────────────────────────────┴───────────────────────────┤
│  💡 Translation in progress... you can see the document updating below      │
└─────────────────────────────────────────────────────────────────────────────┘

░ = Semi-transparent overlay (document visible behind, updating in real-time)
```

**Simplified Overlay:**
- Semi-transparent backdrop - user sees document updating
- Clean centered card:
  - Language flags with arrow
  - Progress ring with percentage
  - Current section name
  - Cancel button
- TipBar shows contextual message
- No stats overload - calm and informative

---

### After Translation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔵 DocTranslate       🇺🇸→🇪🇸      [Translate ▾] [Upload] [Download] 🌐 [?] │
├─────────────────────────────────────────────────┬───────────────────────────┤
│                                                 │                           │
│  ┌───────────────────────────────────────────┐  │  📄 Document              │
│  │                                           │  │  ───────────────────────  │
│  │  ACUERDO DE CONSULTORÍA                   │  │                           │
│  │                                           │  │  🇪🇸 Spanish              │
│  │  Este Acuerdo se celebra a partir de...   │  │  ↩️ (from 🇺🇸 English)    │
│  │                                           │  │                           │
│  │  1. SERVICIOS                             │  │  📄 ~5 pages              │
│  │  El Consultor acuerda proporcionar...     │  │  📝 2,912 words           │
│  │                                           │  │                           │
│  │  2. COMPENSACIÓN                          │  │  ───────────────────────  │
│  │  El Cliente pagará al Consultor...        │  │                           │
│  │                                           │  │  📋 Summary               │
│  │  3. PLAZO                                 │  │                           │
│  │  Este Acuerdo comenzará...                │  │  Un acuerdo de servicios  │
│  │                                           │  │  de consultoría que       │
│  │                                           │  │  describe el alcance,     │
│  │                                           │  │  términos de pago y       │
│  │                                           │  │  obligaciones de          │
│  │                                           │  │  confidencialidad.        │
│  └───────────────────────────────────────────┘  │                           │
│                                                 │                           │
├─────────────────────────────────────────────────┴───────────────────────────┤
│  💡 ✓ Translation complete! Click "↩️" in sidebar to revert if needed    💬 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Post-Translation Indicators:**
- Header: Translation badge `🇺🇸→🇪🇸` shows what was done
- Sidebar: New language + clickable revert link
- TipBar: Contextual success message
- Summary: Auto-regenerates in new language

---

## Feature Details

### 1. Contextual TipBar

**Purpose:** Guide users based on current state without blocking their workflow

**Current:** Shows random tips, always the same style

**Enhanced:** Context-aware tips that adapt to document state

| State | Tip Message |
|-------|-------------|
| Empty editor | "💡 Start typing, drop a DOCX file, or ask the assistant to help" |
| Has content, not translated | "💡 Click 'Translate' or ask the assistant for custom instructions" |
| During translation | "💡 Translation in progress... you can see the document updating" |
| After translation | "💡 ✓ Translation complete! Click '↩️' in sidebar to revert if needed" |
| After revert | "💡 Original document restored" |

**Optional Quick Actions in TipBar:**

The TipBar could include clickable action chips for common tasks:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 💡 Start typing, or try:  [Create a contract] [Write a report] [Help]    💬 │
└─────────────────────────────────────────────────────────────────────────────┘
```

These chips use the widget API:
```javascript
// "Create a contract" chip
onClick: () => {
  OkidokiWidget.insertMessage("Create a formal contract for ", { send: false });
  OkidokiWidget.openChat({ mode: 'text' });
}
```

---

### 2. Translate Dropdown Button (Header)

**Purpose:** One-click translation without typing

**Behavior:**
1. Click "Translate ▾" in header
2. Dropdown shows: Spanish, French, German, Portuguese, Chinese, Other...
3. Select language
4. Triggers: `insertMessage("Translate this document to Spanish", { send: true })`

---

### 3. Executive Summary (Sidebar)

**Purpose:** Show what the document is about at a glance

**Smart Caching Logic:**
```
Document changes detected
    ↓
Start 20-second debounce timer
    ↓
After 20s of no changes:
    ↓
Calculate content hash
    ↓
Compare with last summary's content hash
    ↓
If >5% different OR no summary exists:
    → Generate new summary via widget.ask()
    → Cache: { contentHash, summary, timestamp }
Else:
    → Keep existing summary (no API call)
```

**Display States:**
| State | Display |
|-------|---------|
| Generating | Skeleton loader |
| Ready | Summary text + "Updated Xs ago" |
| Error | Last summary + "outdated" badge |
| Empty doc | "Add content to see summary" |
| Short doc | "Document too short for summary" |

**Cache Storage:**
- In-memory for session
- Optional localStorage for persistence across reloads
- Clear on new document upload

---

### 4. Translation Progress Overlay

**Design Goals:**
- Calm, not stimulating
- Informative without being cluttered
- User can see document updating behind overlay

**Elements:**
1. Semi-transparent backdrop (60% opacity)
2. Centered card (white, rounded, subtle shadow)
3. Language flags with arrow
4. Circular progress indicator with percentage
5. Current section name
6. Cancel button

**What NOT to include:**
- Multiple stat counters
- Live terminology feed
- Flashy animations
- ETA (often inaccurate)

---

### 5. First-Time Onboarding Tour (Optional)

**Library:** React Joyride (or similar)

**Revised approach:** Since we're not blocking the editor, the tour is lighter:

| Step | Target | Content | Action |
|------|--------|---------|--------|
| 1 | Editor | "This is your document editor - start typing anytime" | — |
| 2 | Upload button | "Or upload an existing DOCX file" | — |
| 3 | Translate button | "Translate your document to any language" | — |
| 4 | Chat widget | "Need help? Ask the AI assistant" | `openChat()` |
| 5 | TipBar | "Tips appear here based on what you're doing" | — |

**Trigger:** First visit (check localStorage flag)

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Contextual TipBar with action chips | Low | High |
| 2 | Translate dropdown in header | Low | High |
| 3 | Enhanced sidebar (language, summary) | Medium | Medium |
| 4 | Simplified progress overlay | Medium | Medium |
| 5 | Post-translation indicators | Low | Medium |
| 6 | Onboarding tour (optional) | Medium | Low |

---

## Technical Notes

### Dependencies to Add
- Tour library (optional - React Joyride or Shepherd.js)
- No heavy dependencies needed for core improvements

### State Management
- Summary cache: React state + optional localStorage
- TipBar context: derive from document state + translation state
- Tour completion: localStorage flag (if implemented)

### Components to Modify
- `TipBar.tsx` - Make contextual, add optional action chips
- `Header.tsx` - Add Translate dropdown
- `SummaryPanel.tsx` - Add language detection, executive summary
- `TranslationOverlay.tsx` - Simplify design

### New Components (minimal)
- `TranslateDropdown.tsx` - Language picker (or inline in Header)
- `DocumentSummary.tsx` - Smart cached summary logic

---

## Key Principle: Enhance, Don't Replace

The goal is to **enhance existing components** rather than create new blocking states:

| ❌ Don't | ✅ Do |
|---------|-------|
| Block editor with empty state | Keep editor always visible |
| Force users into workflows | Provide guidance via TipBar |
| Hide functionality | Surface actions in header/TipBar |
| Add complexity | Simplify existing overlays |

---

## Open Questions

1. Should TipBar action chips be always visible or only on empty? (consider: always, but contextual)
2. Should summary auto-collapse when document is short? (yes, <100 words)
3. Keyboard shortcuts? (Cmd+T for translate, Cmd+O for upload - future)
4. Mobile responsive considerations? (future - focus on desktop first)
