'use client';

import { useMemo, useState } from 'react';
import type { FaqItem } from '@/lib/help/faq';
import { faqByCategory } from '@/lib/help/faq';

type Props = {
  items?: FaqItem[];
  showSearch?: boolean;
};

export function FaqAccordion({ items, showSearch = true }: Props) {
  const groups = useMemo(() => {
    if (!items) return faqByCategory();
    const map = new Map<string, FaqItem[]>();
    for (const item of items) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries()).map(([category, list]) => ({
      category,
      items: list,
    }));
  }, [items]);

  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) =>
            item.question.toLowerCase().includes(q) ||
            item.answer.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  return (
    <div className="space-y-4">
      {showSearch ? (
        <label className="block">
          <span className="sr-only">Search FAQ</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-sky-500/30 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2"
          />
        </label>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No matching questions. Try the Help bot or a different search.
        </p>
      ) : (
        filtered.map((group) => (
          <section key={group.category} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {group.category}
            </h3>
            <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {group.items.map((item) => {
                const open = openId === item.id;
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : item.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-slate-50"
                      aria-expanded={open}
                    >
                      <span>{item.question}</span>
                      <span
                        className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
                        aria-hidden
                      >
                        ▾
                      </span>
                    </button>
                    {open ? (
                      <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-sm leading-relaxed text-slate-600">
                        {item.answer}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
