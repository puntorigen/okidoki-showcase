import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Okidoki × DocTranslate | AI Document Translation',
  description: 'Translate documents while preserving formatting, layout, and structure. Supports 50-100+ page documents with industry-aware terminology.',
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

export default function TranslationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      {children}
    </div>
  );
}
