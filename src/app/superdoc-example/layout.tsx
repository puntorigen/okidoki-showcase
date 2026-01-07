import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Okidoki × SuperDoc | AI Document Assistant',
  description: 'Create and edit legal documents with AI assistance. Draft contracts, agreements, and more with intelligent help.',
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

