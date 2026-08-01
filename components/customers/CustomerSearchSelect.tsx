'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import {
  searchCustomers,
  type CustomerSearchHit,
} from '@/app/dashboard/customers/search-actions';
import { cn } from '@/lib/utils';

export function CustomerSearchSelect({
  name = 'customer_id',
  value,
  onChange,
  initialLabel,
  required = true,
  disabled = false,
  placeholder = 'Search customers by name, city, phone…',
}: {
  name?: string;
  value: string;
  onChange: (id: string, customer?: CustomerSearchHit) => void;
  initialLabel?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState(initialLabel || '');
  const [hits, setHits] = useState<CustomerSearchHit[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (initialLabel) setLabel(initialLabel);
  }, [initialLabel]);

  useEffect(() => {
    if (disabled || !open) return;
    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const rows = await searchCustomers(query, 30);
        setHits(rows);
      });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query, open, disabled]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (disabled) {
    return (
      <div>
        <input type="hidden" name={name} value={value} />
        <p className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5 text-sm font-medium text-ink-900">
          {label || 'Customer'}
        </p>
        <p className="mt-1 text-xs text-ink-400">
          Customer is locked after the job is created.
        </p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <input
        type="search"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        value={open ? query : label || query}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value) {
            setLabel('');
            onChange('');
          }
        }}
        className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lg"
        >
          {pending && hits.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-400">Searching…</li>
          ) : hits.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-400">
              {query.trim()
                ? 'No customers match that search.'
                : 'No customers found. Import a CSV or create one first.'}
            </li>
          ) : (
            hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={hit.id === value}
                  className={cn(
                    'flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-brand-50',
                    hit.id === value && 'bg-brand-50'
                  )}
                  onClick={() => {
                    onChange(hit.id, hit);
                    setLabel(hit.name);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  <span className="font-medium text-ink-900">{hit.name}</span>
                  {(hit.city || hit.phone) && (
                    <span className="text-xs text-ink-500">
                      {[hit.city, hit.phone].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {!value && required ? (
        <p className="mt-1 text-xs text-ink-400">
          Click the field to browse, or type a name / phone / city.
        </p>
      ) : value && !disabled ? (
        <p className="mt-1 text-xs text-ink-400">
          Selected — click to search and change customer.
        </p>
      ) : null}
    </div>
  );
}
