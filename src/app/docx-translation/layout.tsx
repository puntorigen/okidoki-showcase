import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Okidoki × DocTranslate | AI Document Translation',
  description: 'Translate documents while preserving formatting, layout, and structure. Supports 50-100+ page documents with industry-aware terminology.',
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
