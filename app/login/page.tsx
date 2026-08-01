import Link from 'next/link';
import { Suspense } from 'react';
import { ProductLockup } from '@/components/brand/ProductMark';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex justify-center">
            <ProductLockup size="lg" />
          </div>
          <p className="mt-3 text-sm text-ink-500">
            AI-first HVAC field service management
          </p>
        </div>

        <Suspense
          fallback={
            <div className="panel p-8 text-center text-sm text-ink-500">
              Loading…
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-ink-500">
          <Link href="/faq" className="font-medium text-sky-700 hover:underline">
            FAQ & help
          </Link>
        </p>
      </div>
    </main>
  );
}
