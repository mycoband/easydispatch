import { HelpPage } from '@/components/help/HelpPage';
import { requireTech } from '@/lib/auth';

export default async function TechHelpPage() {
  await requireTech();
  return <HelpPage homeHref="/tech" homeLabel="My jobs" />;
}
