'use client';

import { useActionState, useState } from 'react';
import { saveCompanySettings } from '@/app/dashboard/settings/actions';
import type { CompanySettings } from '@/lib/company';
import {
  defaultGreeting,
  defaultVoiceFirstMessage,
  defaultVoiceSystemPrompt,
} from '@/lib/intake/script';

type ActionState = {
  error?: string;
  success?: string;
};

const initialState: ActionState = {};

const inputClass =
  'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4';
const labelClass = 'mb-1.5 block text-sm font-medium text-ink-700';

export function CompanySettingsForm({ company }: { company: CompanySettings }) {
  const [state, formAction, pending] = useActionState(
    saveCompanySettings,
    initialState
  );
  const [logoPreview, setLogoPreview] = useState<string | null>(
    company.logo_url
  );

  function onLogoChange(file: File | null) {
    if (!file) {
      setLogoPreview(company.logo_url);
      return;
    }
    setLogoPreview(URL.createObjectURL(file));
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="existing_logo_url" value={company.logo_url ?? ''} />

      <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-start">
        <div>
          <span className={labelClass}>Logo</span>
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt="Company logo"
              className="h-20 w-20 rounded-lg border border-ink-200 bg-white object-contain p-1"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-ink-200 bg-ink-50 text-xs text-ink-400">
              No logo
            </div>
          )}
        </div>
        <label className="block">
          <span className={labelClass}>Upload new logo</span>
          <input
            type="file"
            name="logo"
            accept="image/*"
            onChange={(e) => onLogoChange(e.target.files?.[0] || null)}
            className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
          />
          <p className="mt-1 text-xs text-ink-400">
            PNG, JPG, WebP, or SVG. Shown on invoices, estimates, and the
            customer portal.
          </p>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Company name</span>
          <input
            name="name"
            required
            defaultValue={company.name}
            placeholder="DC Refrigeration"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Legal name</span>
          <input
            name="legal_name"
            defaultValue={company.legal_name ?? ''}
            placeholder="DC Refrigeration LLC"
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Phone</span>
          <input
            name="phone"
            type="tel"
            defaultValue={company.phone ?? ''}
            placeholder="(816) 555-0192"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Email</span>
          <input
            name="email"
            type="email"
            defaultValue={company.email ?? ''}
            placeholder="office@example.com"
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Website</span>
          <input
            name="website"
            defaultValue={company.website ?? ''}
            placeholder="https://example.com"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>
            Google / review URL
            <span className="ml-2 font-normal text-ink-400">
              emailed after paid + complete
            </span>
          </span>
          <input
            name="google_review_url"
            defaultValue={company.google_review_url ?? ''}
            placeholder="https://g.page/r/…"
            className={inputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Street address</span>
        <input
          name="address"
          defaultValue={company.address ?? ''}
          placeholder="1234 N 291 Hwy"
          className={inputClass}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className={labelClass}>City</span>
          <input
            name="city"
            defaultValue={company.city ?? ''}
            placeholder="City"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>State</span>
          <input
            name="state"
            defaultValue={company.state ?? 'MO'}
            maxLength={2}
            className={`${inputClass} uppercase`}
          />
        </label>
        <label className="block">
          <span className={labelClass}>ZIP</span>
          <input
            name="zip"
            defaultValue={company.zip ?? ''}
            placeholder="64108"
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>License number</span>
          <input
            name="license_number"
            defaultValue={company.license_number ?? ''}
            placeholder="HVAC-123456"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Brand color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              defaultValue={company.brand_color || '#1a7af5'}
              onChange={(e) => {
                const hidden = document.getElementById(
                  'brand_color_hidden'
                ) as HTMLInputElement | null;
                if (hidden) hidden.value = e.target.value;
              }}
              className="h-[42px] w-14 shrink-0 cursor-pointer rounded-lg border border-ink-200 bg-white p-1"
            />
            <input
              id="brand_color_hidden"
              name="brand_color"
              defaultValue={company.brand_color || '#1a7af5'}
              className={inputClass}
            />
          </div>
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>
          Invoice footer
          <span className="ml-2 font-normal text-ink-400">
            shown at the bottom of invoices
          </span>
        </span>
        <textarea
          name="invoice_footer"
          rows={2}
          defaultValue={company.invoice_footer ?? ''}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className={labelClass}>
          Estimate footer
          <span className="ml-2 font-normal text-ink-400">
            shown at the bottom of estimates
          </span>
        </span>
        <textarea
          name="estimate_footer"
          rows={2}
          defaultValue={company.estimate_footer ?? ''}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className={labelClass}>
          SMS signature
          <span className="ml-2 font-normal text-ink-400">
            used in text messages instead of “EasyDispatch”
          </span>
        </span>
        <input
          name="sms_signature"
          defaultValue={company.sms_signature ?? ''}
          placeholder="DC Refrigeration"
          className={inputClass}
        />
      </label>

      <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-4">
        <h3 className="font-display text-base font-semibold text-ink-950">
          AI receptionist
        </h3>
        <p className="mt-1 text-xs text-ink-500">
          Used when Feature modules → AI receptionist is on. Inbound SMS and
          phone create undated jobs for the office to schedule. After changing
          toggles, click Save modules. Paste the voice script into Vapi when
          you set up the phone assistant.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={labelClass}>SMS greeting</span>
            <textarea
              name="receptionist_greeting"
              rows={3}
              defaultValue={company.receptionist?.greeting ?? ''}
              placeholder={defaultGreeting(company.name || 'our shop')}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-ink-400">
              First reply when someone texts in. Leave blank to use the default
              above.
            </span>
          </label>
          <div className="sm:col-span-2 space-y-2 rounded-lg border border-ink-200 bg-white p-3">
            <p className="text-sm font-medium text-ink-800">
              Recommended Vapi voice script
            </p>
            <p className="text-xs text-ink-500">
              Copy into Vapi → Assistant → First message and System prompt.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-600">
                First message
              </span>
              <textarea
                readOnly
                rows={2}
                value={defaultVoiceFirstMessage(company.name || 'our shop')}
                className={`${inputClass} bg-ink-50 text-ink-700`}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-600">
                System prompt
              </span>
              <textarea
                readOnly
                rows={8}
                value={defaultVoiceSystemPrompt({
                  shopName: company.name || 'our shop',
                  serviceArea: company.receptionist?.service_area,
                  hoursNote: company.receptionist?.business_hours_note,
                })}
                className={`${inputClass} bg-ink-50 font-mono text-xs text-ink-700`}
                onFocus={(e) => e.target.select()}
              />
            </label>
          </div>
          <label className="block">
            <span className={labelClass}>Service area note</span>
            <input
              name="receptionist_service_area"
              defaultValue={company.receptionist?.service_area ?? ''}
              placeholder="KC metro"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Hours note</span>
            <input
              name="receptionist_hours"
              defaultValue={company.receptionist?.business_hours_note ?? ''}
              placeholder="Mon–Fri 8–5"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Escalate / office alert phone</span>
            <input
              name="receptionist_escalate_phone"
              defaultValue={company.receptionist?.escalate_phone ?? ''}
              placeholder="+18165551212"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Inbound Twilio number (E.164)</span>
            <input
              name="receptionist_twilio_phone"
              defaultValue={company.receptionist?.twilio_phone ?? ''}
              placeholder="+18165551212"
              className={inputClass}
            />
          </label>
        </div>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  );
}
