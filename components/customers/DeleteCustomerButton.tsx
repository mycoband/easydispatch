'use client';

import { useState } from 'react';
import { deleteCustomer } from '@/app/dashboard/customers/actions';

export function DeleteCustomerButton({ customerId }: { customerId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (
      !confirm(
        'Delete this customer and all equipment on the property? This cannot be undone.'
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await deleteCustomer(customerId);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? 'Deleting…' : 'Delete customer'}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
