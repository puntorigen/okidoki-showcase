# Okidoki Showcase

Advanced usage examples for [Okidoki](https://okidoki.chat) AI Chat Widget.

## Examples

### SuperDoc Integration

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
│   └── superdoc-example/           # SuperDoc integration example
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
│           ├── document-parser.ts  # Document structure parsing
│           ├── track-change-utils.ts # Track changes implementation
│           ├── superdoc-helpers.ts # Editor helper functions
│           ├── superdoc-navigator.ts # Document navigation
│           ├── LanguageContext.tsx # i18n context
│           ├── translations.ts     # Translation strings
│           ├── specializations.ts  # Okidoki app configurations
│           └── document-state.ts   # Document state management
```

## Technologies

- **Next.js 16** - React framework
- **Tailwind CSS 4** - Styling
- **SuperDoc** - Document editor ([@harbour-enterprises/superdoc](https://www.npmjs.com/package/@harbour-enterprises/superdoc))
- **Okidoki Widget** - AI chat integration (CDN)
- **Lucide React** - Icons

## Key Concepts

### Client-Side Tools

The SuperDoc example demonstrates how to register custom tools that the AI can invoke:

```typescript
window.OkidokiWidget.registerTools([
  {
    name: 'create_document',
    description: 'Create a new document from scratch...',
    input: { title: { type: 'string' }, ... },
    handler: async ({ title, description, complexity }) => {
      // Tool implementation
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
