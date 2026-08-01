import { ProductLockup } from '@/components/brand/ProductMark';
import {
  companyAddressLine,
  type CompanySettings,
} from '@/lib/company';

export function CompanyBrandHeader({
  company,
  eyebrow,
  title,
  subtitle,
}: {
  company: CompanySettings;
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  const color = company.brand_color || '#1a7af5';
  const addr = companyAddressLine(company);

  return (
    <header className="text-center">
      {company.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={company.logo_url}
          alt={company.name}
          className="mx-auto mb-3 h-14 w-auto object-contain"
        />
      ) : (
        <p
          className="font-display text-2xl font-semibold tracking-tight"
          style={{ color }}
        >
          {company.name}
        </p>
      )}
      {company.logo_url ? (
        <p
          className="font-display text-lg font-semibold tracking-tight"
          style={{ color }}
        >
          {company.name}
        </p>
      ) : null}
      {eyebrow && (
        <p
          className="mt-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color }}
        >
          {eyebrow}
        </p>
      )}
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink-950">
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      <div className="mt-3 space-y-0.5 text-xs text-ink-500">
        {addr && <p>{addr}</p>}
        <p>
          {[company.phone, company.email, company.license_number && `Lic. ${company.license_number}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <div className="mt-4 flex justify-center border-t border-ink-100 pt-3">
        <div className="flex flex-col items-center gap-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
            Powered by
          </p>
          <ProductLockup size="sm" />
        </div>
      </div>
    </header>
  );
}
