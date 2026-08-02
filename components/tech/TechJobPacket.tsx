'use client';

import { useEffect, useState } from 'react';
import { mapsDirectionsUrl, mapsSearchUrl } from '@/lib/tech/maps';
import { formatAddress } from '@/lib/utils';
import { formatTimestamp } from '@/lib/jobs/time-tracking';

export type PacketEquipment = {
  id: string;
  name: string | null;
  equipment_type: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  filter_size: string | null;
  filter_qty: number | null;
  photo_url: string | null;
  refrigerant: string | null;
  electrical: string | null;
};

export type PacketVisit = {
  id: string;
  job_number: string | null;
  job_type: string | null;
  diagnosis: string | null;
  scheduled_start: string | null;
  created_at: string;
  is_callback?: boolean | null;
};

export type JobPacketData = {
  jobId: string;
  customerName: string | null;
  address: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    phone?: string | null;
  };
  accessNotes: string | null;
  customerNotes: string | null;
  internalNotes: string | null;
  equipment: PacketEquipment[];
  recentVisits: PacketVisit[];
  cachedAt: string;
};

const cacheKey = (jobId: string) => `ed-job-packet:${jobId}`;

export function TechJobPacket({
  packet,
  compact = false,
  hideCustomerBlock = false,
}: {
  packet: JobPacketData;
  /** Summary first; full site/equipment/visits behind Show details */
  compact?: boolean;
  /** Hide address/phone when the page header already shows them */
  hideCustomerBlock?: boolean;
}) {
  const [offline, setOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [display, setDisplay] = useState(packet);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    try {
      localStorage.setItem(cacheKey(packet.jobId), JSON.stringify(packet));
    } catch {
      /* ignore quota */
    }
    setDisplay(packet);
    setFromCache(false);
  }, [packet]);

  useEffect(() => {
    function sync() {
      const online = navigator.onLine;
      setOffline(!online);
      if (!online) {
        try {
          const raw = localStorage.getItem(cacheKey(packet.jobId));
          if (raw) {
            setDisplay(JSON.parse(raw) as JobPacketData);
            setFromCache(true);
          }
        } catch {
          /* ignore */
        }
      } else {
        setDisplay(packet);
        setFromCache(false);
      }
    }
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, [packet]);

  const directions = mapsDirectionsUrl(display.address);
  const search = mapsSearchUrl(display.address);
  const addressLabel = formatAddress(display.address) || 'No address on file';
  const eqSummary =
    display.equipment.length === 0
      ? 'No equipment on file'
      : display.equipment.length === 1
        ? display.equipment[0].name ||
          display.equipment[0].equipment_type ||
          '1 unit'
        : `${display.equipment.length} units on file`;

  const details = (
    <>
      {(display.accessNotes || display.customerNotes) && (
        <div className="rounded-xl bg-sky-50 px-3 py-3 text-sm text-sky-950">
          <p className="font-semibold">Site access</p>
          {display.accessNotes && (
            <p className="mt-1 whitespace-pre-wrap">{display.accessNotes}</p>
          )}
          {display.customerNotes && (
            <p className="mt-2 whitespace-pre-wrap text-sky-900/90">
              {display.customerNotes}
            </p>
          )}
        </div>
      )}

      {display.internalNotes && (
        <div className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-950">
          <p className="font-semibold">Dispatcher notes</p>
          <p className="mt-1 whitespace-pre-wrap">{display.internalNotes}</p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-ink-900">Equipment & filters</h3>
        {display.equipment.length === 0 ? (
          <p className="mt-2 text-sm text-ink-400">No equipment on file.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {display.equipment.map((eq) => (
              <li key={eq.id} className="rounded-xl bg-ink-50/60 p-3">
                <div className="flex gap-3">
                  {eq.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={eq.photo_url}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900">
                      {eq.name || eq.equipment_type || 'Unit'}
                      {eq.equipment_type && eq.name
                        ? ` · ${eq.equipment_type}`
                        : ''}
                    </p>
                    <p className="text-xs text-ink-500">
                      {[eq.manufacturer, eq.model, eq.serial_number]
                        .filter(Boolean)
                        .join(' · ') || 'No plate data'}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-800">
                      Filter:{' '}
                      {eq.filter_size
                        ? `${eq.filter_size}${
                            eq.filter_qty ? ` × ${eq.filter_qty}` : ''
                          }`
                        : 'not on file'}
                    </p>
                    {(eq.refrigerant || eq.electrical) && (
                      <p className="mt-0.5 text-xs text-ink-500">
                        {[eq.refrigerant, eq.electrical]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink-900">Recent visits</h3>
        {display.recentVisits.length === 0 ? (
          <p className="mt-2 text-sm text-ink-400">No prior jobs.</p>
        ) : (
          <ul className="mt-2 divide-y divide-ink-100 rounded-xl bg-ink-50/40">
            {display.recentVisits.map((v) => (
              <li key={v.id} className="px-3 py-2 text-sm">
                <p className="font-medium text-ink-800">
                  {v.job_type || 'Job'}
                  {v.is_callback ? ' · Callback' : ''}
                </p>
                <p className="text-xs text-ink-500">
                  {v.job_number} ·{' '}
                  {formatTimestamp(v.scheduled_start || v.created_at)}
                </p>
                {v.diagnosis && (
                  <p className="mt-1 line-clamp-2 text-ink-600">{v.diagnosis}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );

  return (
    <section className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Job packet
          </p>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Site & equipment
          </h2>
          {compact && !expanded && (
            <p className="mt-1 text-sm text-ink-500">
              {eqSummary}
              {display.accessNotes ? ' · Access notes on file' : ''}
              {display.recentVisits.length
                ? ` · ${display.recentVisits.length} prior visit${
                    display.recentVisits.length === 1 ? '' : 's'
                  }`
                : ''}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs font-medium">
          {(offline || fromCache) && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">
              {offline ? 'Offline · showing cache' : 'Cached on device'}
            </span>
          )}
          {!offline && !fromCache && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
              Saved for offline
            </span>
          )}
        </div>
      </div>

      {!hideCustomerBlock && (
        <div className="rounded-xl bg-ink-50/60 p-3">
          <p className="font-medium text-ink-900">{display.customerName}</p>
          <p className="mt-1 text-sm text-ink-700">{addressLabel}</p>
          {display.address.phone && (
            <a
              href={`tel:${display.address.phone}`}
              className="mt-1 inline-block text-sm font-semibold text-brand-700"
            >
              {display.address.phone}
            </a>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {directions && (
              <a
                href={directions}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Directions
              </a>
            )}
            {search && (
              <a
                href={search}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50"
              >
                Open in Maps
              </a>
            )}
          </div>
        </div>
      )}

      {hideCustomerBlock && (directions || search) && (
        <div className="flex flex-wrap gap-2">
          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Directions
            </a>
          )}
          {search && (
            <a
              href={search}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50"
            >
              Open in Maps
            </a>
          )}
        </div>
      )}

      {compact && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          {expanded ? 'Hide packet details' : 'Show packet details'}
        </button>
      )}

      {(!compact || expanded) && <div className="space-y-4">{details}</div>}
    </section>
  );
}
