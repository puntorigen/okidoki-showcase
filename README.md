# Okidoki Showcase

Advanced usage examples for [Okidoki](https://okidoki.chat) AI Chat Widget.

## Examples

### Document Editor Integration

An AI-powered document editor showcasing:
- **Custom Client-Side Tools**: Register tools that the AI can use to manipulate a document editor
- **Document Creation**: AI generates complete legal documents from natural language descriptions
- **Track Changes**: AI modifications are tracked with visual diff markers
- **Multi-language Support**: English and Spanish with automatic widget language sync

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the showcase.

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Home page with example links
│   ├── layout.tsx                  # Root layout with Okidoki widget
│   ├── globals.css                 # Global styles
│   └── superdoc-example/           # Document editor example
│       ├── page.tsx                # Dynamic import wrapper
│       ├── layout.tsx              # Example-specific metadata
│       ├── types.ts                # TypeScript types
│       ├── components/             # React components
│       │   ├── SuperDocPage.tsx    # Main page component
│       │   ├── SuperDocViewer.tsx  # Document editor wrapper
│       │   ├── Header.tsx          # App header with controls
│       │   ├── SummaryPanel.tsx    # Document summary sidebar
│       │   └── TipBar.tsx          # Tips footer
│       └── lib/                    # Utilities and logic
│           ├── superdoc-tools.ts   # Client-side tools for AI
│           ├── document-state.ts   # Document state management
│           ├── LanguageContext.tsx # i18n context
│           ├── translations.ts     # Translation strings
│           └── specializations.ts  # Okidoki app configurations
```

## Technologies

- **Next.js 16** - React framework
- **Tailwind CSS 4** - Styling
- **docx-diff-editor** - Document editor with track changes ([npm](https://www.npmjs.com/package/docx-diff-editor))
- **Okidoki Widget** - AI chat integration (CDN)
- **Lucide React** - Icons

## Key Concepts

### Client-Side Tools

The document editor example demonstrates how to register custom tools that the AI can invoke:

```typescript
window.OkidokiWidget.registerTools([
  {
    name: 'create_document',
    description: 'Create a new document from scratch...',
    input: { title: { type: 'string' }, ... },
    handler: async ({ title, description, complexity }) => {
      // Use docx-diff-editor's setSource to load content
      await viewer.setSource(html);
    }
  },
  {
    name: 'update_document',
    description: 'Make changes to the document...',
    input: { request: { type: 'string' } },
    handler: async ({ request }) => {
      // Use compareWith to show track changes
      await viewer.compareWith(modifiedHtml);
    }
  }
]);
```

### Widget Reinitialization

The example shows how to switch between different Okidoki apps:

```typescript
window.OkidokiWidget.reinitialize(newPublicKey);
```

## License

MIT

## Links

- [Okidoki Website](https://okidoki.chat)
- [Okidoki Documentation](https://okidoki.chat/docs)
- [docx-diff-editor on npm](https://www.npmjs.com/package/docx-diff-editor)
