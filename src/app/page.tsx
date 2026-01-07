import Link from 'next/link';
import { FileText, ArrowRight, Sparkles, Code2 } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-200">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Okidoki Showcase</h1>
            <p className="text-xs text-slate-500">Advanced Usage Examples</p>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
            Explore What&apos;s Possible
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Real-world examples showcasing the power of Okidoki&apos;s AI chat widget 
            with custom tools and integrations.
          </p>
        </div>

        {/* Examples Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* SuperDoc Example */}
          <Link 
            href="/superdoc-example"
            className="group relative bg-white rounded-2xl border border-slate-200 p-8 hover:border-teal-300 hover:shadow-xl hover:shadow-teal-100/50 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-teal-50/50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-teal-200/50 group-hover:scale-105 transition-transform">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                SuperDoc Integration
              </h3>
              <p className="text-slate-600 mb-6 leading-relaxed">
                AI-powered document editor with custom tools for creating, editing, 
                and modifying legal documents with track changes support.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-3 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-full">
                  Custom Tools
                </span>
                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                  Document Editor
                </span>
                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                  Track Changes
                </span>
              </div>
              <div className="flex items-center text-teal-600 font-semibold group-hover:gap-3 gap-2 transition-all">
                <span>Try it out</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Placeholder for more examples */}
          <div className="relative bg-slate-50/50 rounded-2xl border border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center min-h-[320px]">
            <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-6">
              <Code2 className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-400 mb-3">
              More Examples Coming
            </h3>
            <p className="text-slate-400 max-w-xs">
              We&apos;re working on more showcase examples. Check back soon!
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50">
        <div className="max-w-5xl mx-auto px-6 py-8 text-center">
          <p className="text-sm text-slate-500">
            Built with{' '}
            <a 
              href="https://okidoki.chat" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              Okidoki
            </a>
            {' '}— AI Chat Widget for your website
          </p>
        </div>
      </footer>
    </main>
  );
}
