/** Stylized office + tech chrome — no customer names, no fake metrics. */
export function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-200/50 via-transparent to-ink-200/40 blur-2xl"
        aria-hidden
      />
      <div className="relative grid gap-4 lg:grid-cols-[1fr_11.5rem] lg:items-end">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                Dispatch
              </p>
              <p className="font-display text-sm font-semibold text-ink-950">
                Today’s board
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              Live
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 bg-ink-50/80 p-3">
            <Column
              title="Unassigned"
              cards={[
                { label: 'No-cool', meta: 'Assign for me' },
                { label: 'Estimate', meta: 'Install quote' },
              ]}
            />
            <Column
              title="Unit 1"
              cards={[
                { label: 'En route', meta: 'Service' },
                { label: 'On site', meta: 'PM' },
              ]}
            />
            <Column
              title="Unit 2"
              cards={[{ label: 'Scheduled', meta: 'Callback' }]}
            />
          </div>
        </div>

        <div className="mx-auto w-[11.5rem] rounded-[1.6rem] border border-ink-200 bg-ink-950 p-2 shadow-xl">
          <div className="rounded-[1.25rem] bg-white px-3 pb-3 pt-4">
            <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-ink-400">
              My jobs
            </p>
            <div className="mt-2 rounded-xl bg-brand-50 px-3 py-2.5">
              <p className="text-[10px] font-semibold text-brand-700">Next up</p>
              <p className="font-display text-sm font-semibold text-ink-950">
                Service call
              </p>
              <p className="text-[11px] text-ink-500">Arrive → Work → Wrap</p>
            </div>
            <ul className="mt-2 space-y-1.5 text-[11px] text-ink-600">
              <li className="rounded-lg border border-ink-100 px-2 py-1.5">
                Voice-to-notes
              </li>
              <li className="rounded-lg border border-ink-100 px-2 py-1.5">
                Job Walkthrough
              </li>
              <li className="rounded-lg border border-ink-100 px-2 py-1.5">
                OMW draft
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Column({
  title,
  cards,
}: {
  title: string;
  cards: { label: string; meta: string }[];
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 truncate text-[10px] font-semibold uppercase tracking-wide text-ink-400">
        {title}
      </p>
      <div className="space-y-2">
        {cards.map((card) => (
          <div
            key={`${title}-${card.label}`}
            className="rounded-lg border border-ink-200/80 bg-white px-2 py-2 shadow-sm"
          >
            <p className="truncate text-xs font-semibold text-ink-900">
              {card.label}
            </p>
            <p className="truncate text-[10px] text-ink-500">{card.meta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
