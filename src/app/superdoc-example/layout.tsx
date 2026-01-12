import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Okidoki × SuperDoc | AI Document Assistant',
  description: 'Create and edit legal documents with AI assistance. Draft contracts, agreements, and more with intelligent help.',
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

export default function SuperDocLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Uses npm package instead of CDN - styles imported in component
  return (
    <div className="min-h-screen bg-slate-50">
      {children}
    </div>
  );
}

