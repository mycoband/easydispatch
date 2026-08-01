import Link from 'next/link';
import { ProductLockup } from '@/components/brand/ProductMark';
import { FaqAccordion } from '@/components/help/FaqAccordion';

export const metadata = {
  title: 'FAQ · EasyDispatch',
  description: 'Common questions about EasyDispatch HVAC field service software.',
};

export default function PublicFaqPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="inline-flex">
            <ProductLockup size="md" />
          </Link>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href="/login"
              className="font-medium text-sky-700 hover:underline"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-sky-600 px-3 py-1.5 font-medium text-white hover:bg-sky-500"
            >
              Open app
            </Link>
          </div>
        </div>

        <header className="mb-8 space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-950">
            FAQ
          </h1>
          <p className="text-sm text-slate-600">
            Customers, jobs, every Feature module toggle, costing, estimates,
            tech app, and settings. Signed-in users also get Help & FAQ plus
            the Help chat button (bottom-right).
          </p>
        </header>

        <FaqAccordion />

        <p className="mt-10 text-center text-xs text-slate-400">
          Still stuck? Sign in and open Help to ask the AI assistant.
        </p>
      </div>
    </main>
  );
}
