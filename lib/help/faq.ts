export type FaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

export const FAQ_CATEGORIES = [
  'Getting started',
  'Customers',
  'Jobs & calendar',
  'Job costing & reports',
  'Estimates',
  'Tech app',
  'Settings & modules',
  'Billing & account',
] as const;

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'what-is-easydispatch',
    category: 'Getting started',
    question: 'What is EasyDispatch?',
    answer:
      'EasyDispatch is AI-first HVAC field service software. Office staff manage customers, jobs, calendar, dispatch, estimates, invoices, job costing, and reports. Technicians use the tech app for assigned jobs — time tracking, notes, equipment, photos, and on-site estimates. Use the Help button (bottom-right on any signed-in page) to ask the AI bot while you work.',
  },
  {
    id: 'help-bot-popup',
    category: 'Getting started',
    question: 'Where is the AI help bot?',
    answer:
      'Signed in: tap Help in the bottom-right corner on any office or tech page. The chat popup stays available while you navigate; conversation is kept for your browser session. Clear resets the chat. Help / FAQ in the nav has a searchable FAQ. Public FAQ (no login): /faq. Login page also links to FAQ.',
  },
  {
    id: 'office-vs-tech',
    category: 'Getting started',
    question: 'What’s the difference between the office dashboard and the tech app?',
    answer:
      'Office (/dashboard): owners, dispatchers, and office staff — customers, calendar, dispatch, estimates, invoices, reports, job costing, settings. Tech (/tech): only jobs assigned to that technician for field work. Same company data; different screens and permissions.',
  },
  {
    id: 'feature-modules',
    category: 'Settings & modules',
    question: 'How do I turn features on or off?',
    answer:
      'Settings → Feature modules. Each toggle enables or disables a whole category (calendar, estimates, invoices, job costing & profit, reports, AI tools, inventory, etc.). Turning a module off hides its nav/pages and related UI. Owner/dispatcher needs the “Feature modules” permission.',
  },
  {
    id: 'import-customers',
    category: 'Customers',
    question: 'How do I import customers from Housecall Pro or another system?',
    answer:
      'Customers → Import CSV. Use CSV UTF-8 (not .xlsx). Housecall Pro exports are detected automatically (Display Name, phones, all Address_N sites, mashed city/state/zip). Phone-number-only names are skipped as junk; Do Not Service rows are skipped. Shared shop emails (like invoices@…) no longer collapse different companies — we prefer Additional Emails when the primary looks like a shop inbox. Use Remove junk/false customers or Wipe list & prepare re-import, then import again with Skip duplicates.',
  },
  {
    id: 'wipe-import',
    category: 'Customers',
    question: 'Wipe list failed with an equipment / jobs foreign key error.',
    answer:
      'That was fixed: wipe clears job→equipment links before deleting customers. Refresh the app and try Wipe list again. Customers that already have jobs are kept so those jobs stay linked.',
  },
  {
    id: 'search-customers',
    category: 'Customers',
    question: 'How do I pick a customer on a new job?',
    answer:
      'On New job, click Customer to browse or search by name, city, or phone (full list). From a customer profile, New job pre-fills that customer (you can still change it). Double-click a site/property — or use New job on that site — to start a job for that address. After the job is created, the customer is locked.',
  },
  {
    id: 'multi-site',
    category: 'Customers',
    question: 'How do multiple sites / properties work?',
    answer:
      'On the customer profile, Sites / properties lists addresses. Import from HCP brings Address_1… sites. On a job, choose Job site when the customer has more than one. Double-click a site to create a job for it.',
  },
  {
    id: 'job-numbers',
    category: 'Jobs & calendar',
    question: 'How do job numbers work?',
    answer:
      'New jobs default to the next number (#1, #2, #3…). Rename anytime in Job details → Job # / name (e.g. “River Market Bistro”), then Save.',
  },
  {
    id: 'calendar-drag',
    category: 'Jobs & calendar',
    question: 'How do I reschedule a job on the calendar?',
    answer:
      'Open Calendar, drag a job onto another day, and drop it. Time of day is kept; only the date changes. You can drop on the whole day cell, including near the date label.',
  },
  {
    id: 'ai-ticket',
    category: 'Jobs & calendar',
    question: 'What does AI ticket fill do?',
    answer:
      'On New job (when AI tools module is on), paste or dictate call notes → Fill ticket with AI. Grok drafts job type, priority, diagnosis, notes, and may match an existing customer. Always review before creating the job.',
  },
  {
    id: 'job-costing-where',
    category: 'Job costing & reports',
    question: 'Where is job costing? I only see Settings and Reports.',
    answer:
      'There is no separate “Job Costing” nav tab. Enable Settings → Feature modules → Job costing & profit. Then: (1) Settings → Job costing for target margin, tech wages, and optional weekly profit digest; (2) open any job for the Sold / Cost / Profit / Margin panel; (3) estimates show projected P&L before you send; (4) Reports for profit KPIs; (5) Export → Job costing / Tech P&L CSV for your accountant; (6) truck-stock deduct adds a costed parts line automatically. Run supabase/job-costing.sql once in Supabase if panels look empty.',
  },
  {
    id: 'job-costing-how',
    category: 'Job costing & reports',
    question: 'How do I set up job costing so numbers are right?',
    answer:
      '1) Turn on Job costing & profit. 2) Settings → Job costing: target margin %, burden %, default labor $/hr, optional overhead, weekly digest email. 3) Set each tech’s $/hr wage. 4) Pricebook: Cost + Sell + type. 5) On jobs, Cost $ on line items (inventory deduct and pricebook presets fill cost). 6) Clock hours + tech wage feed labor. Save line items to refresh P&L. Check estimate P&L before sending quotes.',
  },
  {
    id: 'costing-export-digest',
    category: 'Job costing & reports',
    question: 'How do I export job costing CSV or get a weekly profit email?',
    answer:
      'Export (Export module): pick a date range → Job costing (P&L) for per-job sold/cost/profit/margin, or Tech P&L summary for rollup by technician — CSV for your accountant. Weekly digest: Settings → Job costing → enable Weekly owner profit digest and set an email (or company email). Mondays the app emails last week’s totals, by-tech profit, and lowest-margin jobs (needs Resend configured).',
  },
  {
    id: 'margin-coach',
    category: 'Job costing & reports',
    question: 'What is AI margin coach and Ask Reports?',
    answer:
      'On a job (costing + AI modules on): AI margin coach reads that job’s P&L and suggests how to hit target margin. On Reports: Ask Reports answers questions in plain English about the selected date range (profit, techs, job types, losers). Both need AI tools enabled under Feature modules.',
  },
  {
    id: 'reports-vs-costing',
    category: 'Job costing & reports',
    question: 'What’s on the Reports page?',
    answer:
      'Always (Reports module on): paid revenue, completed unpaid, AR, avg ticket, hours, estimate close rate, AR aging, tech productivity, unpaid invoices. With Job costing & profit on: gross profit, total cost, avg margin, jobs below target, profit by tech, profit by job type, lowest-profit jobs, plus Ask Reports AI if AI tools are on.',
  },
  {
    id: 'estimates-on-jobs',
    category: 'Estimates',
    question: 'How do estimates link to jobs?',
    answer:
      'From a job: New estimate (office) or Build estimate (tech). The estimate links to that job and customer. When approved, Apply to job copies line items onto the job. Estimates list shows customer and job #. Needs Estimates module (and manage_estimates permission for techs).',
  },
  {
    id: 'tech-estimate',
    category: 'Tech app',
    question: 'Can technicians create estimates?',
    answer:
      'Yes if Estimates is enabled and the tech has “Build estimates on jobs” (default on). Open an assigned job → Build estimate. Techs only edit estimates on their assigned jobs.',
  },
  {
    id: 'tech-permissions',
    category: 'Tech app',
    question: 'How do I control what techs can do?',
    answer:
      'Settings → Role permissions. Toggle time tracking, notes, media, estimates, invoices, line-item editing, and more for technician vs dispatcher/office. Job cost visibility for techs is under Settings → Job costing (“Techs can see job cost / margin”).',
  },
  {
    id: 'plans',
    category: 'Billing & account',
    question: 'What plans are available?',
    answer:
      'Starter and Pro are self-serve from Settings → Billing. Enterprise (including AI SMS intake) is listed as coming soon. Contact your EasyDispatch admin for plan changes.',
  },
  {
    id: 'confirm-email',
    category: 'Billing & account',
    question: 'I signed up but can’t log in.',
    answer:
      'Check email for a confirmation link from EasyDispatch (noreply@easydispatch.app). Confirm, then sign in. Check spam if nothing arrives, or try signing up again with the same email after a few minutes.',
  },
];

export function faqByCategory() {
  const map = new Map<string, FaqItem[]>();
  for (const item of FAQ_ITEMS) {
    const list = map.get(item.category) || [];
    list.push(item);
    map.set(item.category, list);
  }
  return FAQ_CATEGORIES.map((category) => ({
    category,
    items: map.get(category) || [],
  })).filter((g) => g.items.length > 0);
}

/** Compact FAQ text for the help bot system prompt. */
export function faqPromptBlock() {
  return FAQ_ITEMS.map(
    (f, i) => `${i + 1}. Q: ${f.question}\nA: ${f.answer}`
  ).join('\n\n');
}
