# Okidoki Widget - New Methods

New programmatic methods to enable tighter integration between app UIs and the Okidoki chat widget.

---

## Methods

### 1. `widget.insertMessage(text, options?)`

**Purpose:** Insert text into the chat input field, optionally auto-sending it.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | `string` | Yes | The message text to insert |
| `options.send` | `boolean` | No | If `true`, automatically sends the message (default: `false`) |

**Returns:** `void`

**Example usage:**
```js
// Insert text for user to review before sending
widget.insertMessage("Translate this document to Spanish")

// Insert and immediately send
widget.insertMessage("Create a contract", { send: true })
```

---

### 2. `widget.openChat(options?)`

**Purpose:** Programmatically open the chat panel in a specified mode.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options.mode` | `'text' \| 'voice' \| 'video'` | No | Which mode to open (default: `'text'`) |

**Returns:** `void`

**Example usage:**
```js
// Open chat in default text mode
widget.openChat()

// Open chat in voice mode
widget.openChat({ mode: 'voice' })

// Open chat in video mode
widget.openChat({ mode: 'video' })
```

---

### 3. `widget.clearInput()`

**Purpose:** Clear the chat input field. Useful for cleanup after tours or cancelled actions.

**Parameters:** None

**Returns:** `void`

**Example usage:**
```js
// Clear any text in the input field
widget.clearInput()
```

---

## Use Cases

### Quick Action Buttons

App UI buttons that trigger common actions through the chat:

```js
// "Translate" button in app header
translateButton.onclick = () => {
  widget.insertMessage(`Translate this document to ${selectedLanguage}`, { send: true })
}

// "Summarize" button
summarizeButton.onclick = () => {
  widget.insertMessage("Summarize this document", { send: true })
}
```

### Onboarding Tour

Guide first-time users through the interface:

```js
// Tour step: Show how to use chat
tourStep3.onEnter = () => {
  widget.openChat({ mode: 'text' })
}

// Tour step: Show example prompt
tourStep4.onEnter = () => {
  widget.insertMessage("Create a sample invoice")
}

// Tour completed or dismissed: Clean up
tour.onComplete = () => {
  widget.clearInput()
}
```

### Contextual Help

Open chat with pre-filled context based on user actions:

```js
// User right-clicks on selected text
contextMenu.onTranslateSelection = () => {
  widget.openChat()
  widget.insertMessage(`Translate the selected text to Spanish`)
}
```

---

## Integration with DocTranslate App

These methods enable the following UX improvements:

1. **Empty State** - Buttons inject example prompts:
   - "Create a document" → `insertMessage("Create a...", { send: false })`
   - "Try an example" → `insertMessage("Create a sample contract", { send: true })`

2. **Header Actions** - Direct translate button:
   - "Translate to Spanish" → `insertMessage("Translate to Spanish", { send: true })`

3. **First-Time Tour** - Guided onboarding:
   - Highlight chat → `openChat()`
   - Show example → `insertMessage("...")`
   - Cleanup → `clearInput()`

---

## Notes

- All methods should be no-ops if the widget is not initialized
- `openChat()` should respect any existing mode restrictions (e.g., if voice is disabled)
- `insertMessage()` should focus the input field after inserting text
