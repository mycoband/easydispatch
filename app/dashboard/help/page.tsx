import { HelpPage } from '@/components/help/HelpPage';
import { requireOffice } from '@/lib/auth';

export default async function OfficeHelpPage() {
  await requireOffice();
  return <HelpPage homeHref="/dashboard" homeLabel="Dashboard" />;
}
