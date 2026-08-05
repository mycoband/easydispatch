import Link from 'next/link';
import { AppNav } from '@/components/AppNav';
import { HelpChatWidget } from '@/components/help/HelpChatWidget';
import { InstallAppPrompt } from '@/components/pwa/InstallAppPrompt';
import { TechViewToggle } from '@/components/tech/TechViewToggle';
import { isOfficeTechViewEnabled, requireOffice } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { navItemsForModules } from '@/lib/company/modules';
import { roleHasPermission } from '@/lib/company/permissions';
import { loadCompanyById, companyAccessBlocked } from '@/lib/tenant';

const officeNav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/day-sheet', label: 'Day sheet' },
  { href: '/dashboard/dispatch', label: 'Dispatch' },
  { href: '/dashboard/jobs', label: 'Jobs' },
  { href: '/dashboard/intake', label: 'AI receptionist' },
  { href: '/dashboard/calendar', label: 'Calendar' },
  { href: '/dashboard/estimates', label: 'Estimates' },
  { href: '/dashboard/customers', label: 'Customers' },
  { href: '/dashboard/agreements', label: 'Agreements' },
  { href: '/dashboard/inventory', label: 'Inventory' },
  { href: '/dashboard/parts', label: 'Parts' },
  { href: '/dashboard/pricebook', label: 'Pricebook' },
  { href: '/dashboard/invoices', label: 'Invoices' },
  { href: '/dashboard/callbacks', label: 'Callbacks' },
  { href: '/dashboard/reports', label: 'Reports' },
  { href: '/dashboard/export', label: 'Export' },
  { href: '/dashboard/help', label: 'Help' },
];

export default async function OfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ profile }, company, techViewOn] = await Promise.all([
    requireOffice(),
    loadCompanySettings(),
    isOfficeTechViewEnabled(),
  ]);
  const allowTechView = Boolean(company.modules.tech_view_office);

  let billingBanner: string | null = null;
  if (profile.company_id) {
    try {
      const tenant = await loadCompanyById(profile.company_id);
      if (tenant?.subscription_status === 'trialing' && tenant.trial_ends_at) {
        const days = Math.ceil(
          (new Date(tenant.trial_ends_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        );
        if (days <= 5) {
          billingBanner =
            days <= 0
              ? 'Trial ended — choose a plan to keep full access.'
              : `Trial ends in ${days} day${days === 1 ? '' : 's'}.`;
        }
      } else if (companyAccessBlocked(tenant)) {
        billingBanner = 'Billing needs attention — update your plan.';
      }
    } catch {
      // companies table may not exist yet
    }
  }

  let items = navItemsForModules(officeNav, company.modules);
  // Hide nav items the role cannot use
  items = items.filter((item) => {
    if (item.href.startsWith('/dashboard/reports') || item.href.startsWith('/dashboard/export')) {
      return roleHasPermission(
        profile.role,
        'view_reports',
        company.role_permissions
      );
    }
    if (item.href.startsWith('/dashboard/pricebook')) {
      return roleHasPermission(
        profile.role,
        'manage_pricebook',
        company.role_permissions
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen">
      <AppNav
        brandHref="/dashboard"
        items={items}
        profile={profile}
        dense
        companyName={company.name || 'Company'}
        companyLogoUrl={company.logo_url}
        settingsHref="/dashboard/settings"
        helpHref="/dashboard/help"
        trailing={
          allowTechView ? (
            <TechViewToggle enabled={techViewOn} variant="nav" />
          ) : undefined
        }
      />
      <InstallAppPrompt />
      {billingBanner && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
          {billingBanner}{' '}
          <Link
            href="/dashboard/settings/billing"
            className="font-semibold underline"
          >
            Billing
          </Link>
        </div>
      )}
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      <HelpChatWidget faqHref="/dashboard/help" />
    </div>
  );
}
