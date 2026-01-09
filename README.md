# Okidoki Showcase

Advanced usage examples for [Okidoki](https://okidoki.chat) AI Chat Widget.

## Examples

### 1. Document Editor (SuperDoc)

An AI-powered document editor showcasing:
- **Custom Client-Side Tools**: Register tools that the AI can use to manipulate a document editor
- **Document Creation**: AI generates complete legal documents from natural language descriptions
- **Track Changes**: AI modifications are tracked with visual diff markers
- **Multi-language Support**: English and Spanish with automatic widget language sync

### 2. Document Translation (DocTranslate)

AI-powered document translation with advanced features:
- **Full Document Translation**: Translate entire documents (50-100+ pages) while preserving formatting
- **Format Preservation**: Tables, lists, bold, italic, and document structure are maintained
- **Smart Batching**: Large documents are processed in sections for consistency
- **Industry Detection**: Automatically detects document type (legal, technical, medical, etc.) for appropriate terminology
- **Glossary Management**: Extracts and maintains consistent terminology throughout translation
- **Crash Recovery**: Translation state is persisted to localStorage for resume capability
- **Load DOCX**: Import existing Word documents for translation
- **Surgical Updates**: Edit specific parts of the document without affecting other content

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
│   ├── superdoc-example/           # Document editor example
│   │   ├── page.tsx                # Dynamic import wrapper
│   │   ├── layout.tsx              # Example-specific metadata
│   │   ├── types.ts                # TypeScript types
│   │   ├── components/             # React components
│   │   └── lib/                    # Utilities and logic
│   └── docx-translation/           # Document translation example
│       ├── page.tsx                # Dynamic import wrapper
│       ├── layout.tsx              # Example-specific metadata
│       ├── types.ts                # TypeScript types
│       ├── components/             # React components
│       │   ├── TranslationPage.tsx # Main page component
│       │   ├── TranslationViewer.tsx # Document editor wrapper
│       │   ├── TranslationOverlay.tsx # Translation progress overlay
│       │   └── ...                 # Other UI components
│       └── lib/                    # Utilities and logic
│           ├── translation-tools.ts # Translation & update tools
│           └── ...                 # Context, translations, etc.
├── lib/
│   └── translation/                # Shared translation library
│       ├── translation-orchestrator.ts # Main translation coordinator
│       ├── batching-engine.ts      # Document chunking for large docs
│       ├── segment-translator.ts   # Format-preserving translation
│       ├── document-accumulator.ts # Rebuilds translated document
│       ├── glossary-manager.ts     # Term consistency management
│       ├── industry-detector.ts    # Document type detection
│       └── ...                     # Cache, persistence, types
```

## Technologies

- **Next.js 16** - React framework
- **Tailwind CSS 4** - Styling
- **docx-diff-editor** - Document editor with track changes ([npm](https://www.npmjs.com/package/docx-diff-editor))
- **Okidoki Widget** - AI chat integration (CDN)
- **Lucide React** - Icons

## Key Concepts

### Client-Side Tools

The examples demonstrate how to register custom tools that the AI can invoke:

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
    name: 'translate_document',
    description: 'Translate the entire document...',
    input: { 
      source_language: { type: 'string' },
      target_language: { type: 'string' }
    },
    handler: async ({ source_language, target_language }) => {
      // Orchestrator handles batching, glossary, progress
      await orchestrator.translate(documentJson, options, widget, callbacks);
    }
  },
  {
    name: 'update_document',
    description: 'Make surgical changes to the document...',
    input: { request: { type: 'string' } },
    handler: async ({ request }) => {
      // Extract segments, ask LLM for changes, apply surgically
      await viewer.compareWith(updatedJson);
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
