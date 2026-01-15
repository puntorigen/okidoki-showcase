import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Okidoki × Sketch Canvas | AI-Powered Drawing',
  description: 'Create sketches with AI assistance. Draw freely, and let AI help you build your scene incrementally through natural language.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [
      { url: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export default function SketchCanvasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-900">
      {children}
    </div>
  );
}
