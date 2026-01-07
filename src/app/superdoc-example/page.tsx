'use client';

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with SuperDoc
const SuperDocPage = dynamic(
  () => import('./components/SuperDocPage'),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading document editor...</p>
        </div>
      </div>
    ),
  }
);

export default function Page() {
  return <SuperDocPage />;
}

