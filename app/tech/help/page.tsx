import { HelpPage } from '@/components/help/HelpPage';
import { requireTechApp } from '@/lib/auth';

export default async function TechHelpPage() {
  await requireTechApp();
  return <HelpPage homeHref="/tech" homeLabel="My jobs" />;
}
