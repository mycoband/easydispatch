'use client';

import { useState } from 'react';
import { saveTechSkills } from '@/app/dashboard/settings/skills-actions';
import { HVAC_SKILL_TAGS } from '@/lib/hvac/skills';
import { cn } from '@/lib/utils';

export type TechProfile = {
  id: string;
  full_name: string | null;
  role: string;
  skills: string[] | null;
  certifications: string | null;
};

export function TechSkillsEditor({ techs }: { techs: TechProfile[] }) {
  if (techs.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        No technicians, owners, or dispatchers on the roster yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {techs.map((tech) => (
        <TechSkillsRow key={tech.id} tech={tech} />
      ))}
    </div>
  );
}

function TechSkillsRow({ tech }: { tech: TechProfile }) {
  const [skills, setSkills] = useState<string[]>(tech.skills ?? []);
  const [certifications, setCertifications] = useState(
    tech.certifications ?? ''
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  function toggleSkill(skill: string) {
    setDirty(true);
    setMessage(null);
    setSkills((prev) =>
      prev.includes(skill)
        ? prev.filter((s) => s !== skill)
        : [...prev, skill]
    );
  }

  async function save() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await saveTechSkills(tech.id, skills, certifications);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Saved');
      setDirty(false);
    }
    setPending(false);
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-ink-950">
            {tech.full_name || 'Unnamed'}
          </p>
          <p className="text-xs uppercase tracking-wide text-ink-500">
            {tech.role}
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {HVAC_SKILL_TAGS.map((skill) => {
          const active = skills.includes(skill);
          return (
            <button
              key={skill}
              type="button"
              onClick={() => toggleSkill(skill)}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-semibold transition',
                active
                  ? 'bg-teal-600 text-white'
                  : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
              )}
            >
              {skill}
            </button>
          );
        })}
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-ink-600">
          Certifications
        </span>
        <input
          value={certifications}
          onChange={(e) => {
            setDirty(true);
            setMessage(null);
            setCertifications(e.target.value);
          }}
          placeholder="EPA 608 Universal, NATE Core & HVAC…"
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
        />
      </label>

      {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
