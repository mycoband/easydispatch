import Link from 'next/link';
import { requireOffice, type AppRole } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { roleHasPermission } from '@/lib/company/permissions';
import { loadCompanyById } from '@/lib/tenant';
import { ensureOwnerRole } from '@/lib/tenant/ensure-owner';
import { CompanySettingsForm } from '@/components/settings/CompanySettingsForm';
import { ModuleToggles } from '@/components/settings/ModuleToggles';
import { RolePermissionsEditor } from '@/components/settings/RolePermissionsEditor';
import { TeamMembersPanel } from '@/components/settings/TeamMembersPanel';
import { TechSkillsEditor } from '@/components/settings/TechSkillsEditor';
import { CostingSettingsForm } from '@/components/settings/CostingSettingsForm';
import { TechWagesEditor } from '@/components/settings/TechWagesEditor';

export default async function SettingsPage() {
  const ctx = await requireOffice();
  const profile = await ensureOwnerRole(ctx.profile);
  const { supabase } = ctx;

  let teamQuery = supabase
    .from('profiles')
    .select(
      'id, full_name, role, skills, certifications, company_id, hourly_cost, burden_pct'
    )
    .order('full_name', { ascending: true });
  if (profile.company_id) {
    teamQuery = teamQuery.eq('company_id', profile.company_id);
  }

  let [company, teamRes, tenant] = await Promise.all([
    loadCompanySettings(),
    teamQuery,
    profile.company_id
      ? loadCompanyById(profile.company_id).catch(() => null)
      : Promise.resolve(null),
  ]);

  let teamRows = teamRes.data;
  if (teamRes.error) {
    let legacy = supabase
      .from('profiles')
      .select('id, full_name, role, skills, certifications, company_id')
      .order('full_name', { ascending: true });
    if (profile.company_id) {
      legacy = legacy.eq('company_id', profile.company_id);
    }
    const legacyRes = await legacy;
    teamRows = (legacyRes.data ?? []).map((p) => ({
      ...p,
      hourly_cost: null,
      burden_pct: null,
    }));
  }

  const members = (teamRows ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role as AppRole,
  }));

  const techs = (teamRows ?? []).filter((p) =>
    ['technician', 'owner', 'dispatcher'].includes(p.role)
  );

  const perms = company.role_permissions;
  const canSettings = roleHasPermission(
    profile.role,
    'manage_settings',
    perms
  );
  const canModules = roleHasPermission(profile.role, 'manage_modules', perms);
  const canPermissions = roleHasPermission(
    profile.role,
    'manage_permissions',
    perms
  );
  const canManageTeam =
    profile.role === 'owner' || profile.role === 'dispatcher';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Settings
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Team, company profile, roles, and feature modules.
          </p>
          <p className="mt-1 text-xs text-ink-400">
            Signed in as {profile.full_name || 'User'} · {profile.role}
          </p>
        </div>
        <Link
          href="/dashboard/settings/billing"
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Billing & plan
        </Link>
      </div>

      {canManageTeam && (
        <section className="panel p-5">
          <TeamMembersPanel
            members={members}
            inviteCode={tenant?.invite_code ?? null}
            companyName={tenant?.name || company.name}
          />
        </section>
      )}

      {!profile.company_id && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No company linked to your user yet. Sign out and sign back in, or
          create a new account with <strong>Start a company</strong>. If this
          keeps happening, contact support.
        </div>
      )}

      {canPermissions && (
        <section className="panel p-5">
          <h2 className="mb-1 font-display text-lg font-semibold text-ink-950">
            Role permissions
          </h2>
          <p className="mb-4 text-sm text-ink-500">
            Control what technicians can do in the field versus dispatchers and
            office staff.
          </p>
          <RolePermissionsEditor initial={company.role_permissions} />
        </section>
      )}

      {canModules && (
        <section className="panel p-5">
          <h2 className="mb-1 font-display text-lg font-semibold text-ink-950">
            Feature modules
          </h2>
          <p className="mb-4 text-sm text-ink-500">
            Master on/off for every optional feature. Use shop presets (Simple,
            Full field, Full shop) to set many toggles at once, then Save
            modules. Each toggle has a FAQ under Help → Settings & modules.
          </p>
          <ModuleToggles initial={company.modules} />
        </section>
      )}

      {canSettings && company.modules.job_costing && (
        <section id="job-costing" className="panel scroll-mt-20 p-5">
          <h2 className="mb-1 font-display text-lg font-semibold text-ink-950">
            Job costing
          </h2>
          <div className="mt-4">
            <CostingSettingsForm initialCosting={company.costing} />
          </div>
          <div className="mt-8 border-t border-ink-100 pt-6">
            <h3 className="font-display text-base font-semibold text-ink-950">
              Tech wages (labor cost)
            </h3>
            <div className="mt-3">
              <TechWagesEditor
                techs={(techs ?? []).map((t) => ({
                  id: t.id,
                  full_name: t.full_name,
                  role: t.role,
                  hourly_cost:
                    (t as { hourly_cost?: number | null }).hourly_cost ?? null,
                  burden_pct:
                    (t as { burden_pct?: number | null }).burden_pct ?? null,
                }))}
              />
            </div>
          </div>
        </section>
      )}

      {canSettings && (
        <section className="panel p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-ink-950">
            Company profile
          </h2>
          <CompanySettingsForm company={company} />
        </section>
      )}

      {!canSettings && !canModules && !canPermissions && !canManageTeam && (
        <div className="panel p-5 text-sm text-ink-600">
          Your role can&apos;t change settings. Ask an owner or dispatcher with
          permission.
        </div>
      )}

      <section className="panel p-5">
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Tech roster skills
        </h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Used for dispatch skill matching against a job&apos;s required
          skills.
        </p>
        <div className="mt-4">
          <TechSkillsEditor techs={techs ?? []} />
        </div>
      </section>
    </div>
  );
}
