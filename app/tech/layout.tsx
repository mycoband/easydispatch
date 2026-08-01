import { AppNav } from '@/components/AppNav';
import { HelpChatWidget } from '@/components/help/HelpChatWidget';
import { requireTech } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';

const techNav = [
  { href: '/tech', label: 'My jobs' },
  { href: '/tech/help', label: 'Help' },
];

export default async function TechLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ profile }, company] = await Promise.all([
    requireTech(),
    loadCompanySettings(),
  ]);

  return (
    <div className="min-h-screen">
      <AppNav
        brandHref="/tech"
        items={techNav}
        profile={profile}
        companyName={company.name || 'Company'}
        companyLogoUrl={company.logo_url}
        helpHref="/tech/help"
      />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">{children}</main>
      <HelpChatWidget faqHref="/tech/help" />
    </div>
  );
}
