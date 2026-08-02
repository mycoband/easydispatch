import { COMPANY_MODULES, MODULE_GROUPS } from '@/lib/company/modules';

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
  'Invoices & PDFs',
  'Tech app',
  'Settings & modules',
  'Billing & account',
] as const;

/** Every Feature modules toggle — kept in sync with lib/company/modules.ts */
export const MODULE_FAQ_ITEMS: FaqItem[] = COMPANY_MODULES.map((m) => ({
  id: `module-${m.id}`,
  category: 'Settings & modules',
  question: `What does “${m.label}” control?`,
  answer: `${m.description} ${m.help} Toggle in Settings → Feature modules${
    m.href ? ` (nav: ${m.href})` : ''
  }. Group: ${m.group}.${m.defaultEnabled ? '' : ' Default: off.'}`,
}));

const CORE_FAQ_ITEMS: FaqItem[] = [
  {
    id: 'what-is-easydispatch',
    category: 'Getting started',
    question: 'What is EasyDispatch?',
    answer:
      'EasyDispatch is AI-first HVAC field service software. Office staff manage customers, jobs, calendar, dispatch, estimates, invoices, job costing, PDFs, and reports. Technicians use the tech app for assigned jobs — time tracking, notes, equipment, photos, video AI Job Walkthrough, run-sheet PDF, and on-site estimates. Use Help (bottom-right) to ask the AI bot while you work. Turn categories on/off in Settings → Feature modules.',
  },
  {
    id: 'help-bot-popup',
    category: 'Getting started',
    question: 'Where is the AI help bot?',
    answer:
      'Signed in: tap Help in the bottom-right on any office or tech page. Chat stays for your browser session; Clear resets it. Help / FAQ in the nav is searchable. Public FAQ (no login): /faq. Login also links to FAQ. AI tools module must be on for the bot.',
  },
  {
    id: 'office-vs-tech',
    category: 'Getting started',
    question: 'What’s the difference between the office dashboard and the tech app?',
    answer:
      'Office (/dashboard): starts with a Needs you inbox (unassigned jobs, unpaid invoices, today’s callbacks), then today’s board/stats — plus customers, calendar, dispatch, estimates, invoices, reports, job costing, settings. Open a job for Job assistant (AI tools) to draft texts or check invoice gaps. Tech (/tech): My jobs opens with a Next up card, then quieter Today/Later/Done groups; job tickets use Arrive → Work → Wrap up (time, walkthrough, notes, sign/pay). Real techs see jobs assigned to them. Office can open the same screens via Technician view (Settings → Feature modules → Technician view (office); then Tech view in the header).',
  },
  {
    id: 'needs-you-dashboard',
    category: 'Getting started',
    question: 'What is Needs you on the dashboard?',
    answer:
      'Office home (/dashboard) leads with Needs you — not another stats strip. It lists unassigned open jobs (→ Dispatch or the job), unpaid sent invoices (→ Invoices), and today’s callbacks when Callbacks is on. Each row is one line with a deep link. Today’s schedule and counts stay below as secondary. Uses existing Dispatch and Invoices modules (no separate toggle).',
  },
  {
    id: 'tech-next-up',
    category: 'Tech app',
    question: 'What’s Next up on My jobs?',
    answer:
      'Tech home (/tech) shows a large Next up card: the first actionable job (In progress, else the first Today job). One primary button opens that job at the right phase (?phase= from live status). A secondary line shows how many stops are left today. Today / Later / Done groups stay below, quieter. Office Technician view keeps assignee names on cards.',
  },
  {
    id: 'tech-ticket-phases',
    category: 'Tech app',
    question: 'How does the tech job ticket work (Arrive / Work / Wrap up)?',
    answer:
      'Open a job from My jobs (or Next up). Three phases: Arrive (Drive/Arrive, packet, message), Work (walkthrough hero when enabled — Record → Generate → Apply & wrap up), Wrap up (clock out, signature, invoice). Tapping Arrive auto-opens Work; Clock out auto-opens Wrap up; Apply & wrap up also jumps to Wrap. Manual tab jumps still work. Default phase also follows live status. Office staff use Technician view to see the same layout.',
  },
  {
    id: 'feature-modules',
    category: 'Settings & modules',
    question: 'How do I turn features on or off?',
    answer: `Settings → Feature modules. Use shop presets (Simple, Full field, Full shop) to set many toggles at once, or flip individual switches — then Save modules. Off hides its nav/pages and related buttons. Owner/dispatcher needs the “Feature modules” permission. Groups: ${MODULE_GROUPS.join(', ')}. Core customers + jobs always stay on. Example: AI Job Walkthrough (Field / tech) shows/hides the video walkthrough panel; AI tools gates Generate Report. Every module is listed in this FAQ under “What does … control?”`,
  },
  {
    id: 'shop-presets',
    category: 'Settings & modules',
    question: 'What are Simple / Full field / Full shop presets?',
    answer:
      'Settings → Feature modules → Shop presets. Simple: lean shop (dispatch, calendar, invoices, messaging, AI field tools, PDFs, Technician view). Full field: Simple plus day sheet, Assign-tech AI, capacity warnings, safety, equipment timeline, callbacks, review ask, customer portal. Full shop: every module on. Presets only change the toggles on screen — click Save modules to apply. You can still tweak individual modules after picking a preset.',
  },
  {
    id: 'modules-list',
    category: 'Settings & modules',
    question: 'What does each feature module control?',
    answer: `Full catalog (same list as Settings → Feature modules):\n${COMPANY_MODULES.map(
      (m) => `• ${m.label}: ${m.description}`
    ).join('\n')}\nSQL once as needed: supabase/workflow-depth.sql, differentiation.sql, ops-polish.sql, job-costing.sql, ai-walkthrough.sql + ai-walkthrough-video.sql (AI Job Walkthrough video).`,
  },
  {
    id: 'ai-walkthrough-settings',
    category: 'Settings & modules',
    question: 'How do I turn AI Job Walkthrough on or off?',
    answer:
      'Settings → Feature modules → Field / tech → AI Job Walkthrough. On (default): Job Walkthrough (AI) panel on tech and office jobs — record video (camera+mic), voice, or photos. Off: panel hidden. Generate needs AI tools + XAI_API_KEY; video also needs OPENAI_API_KEY (Whisper hear) and auto-extracted frames (Grok see). Download PDF needs PDF documents. Run supabase/ai-walkthrough.sql once; if video upload fails on kind, run ai-walkthrough-video.sql.',
  },
  {
    id: 'live-dispatch',
    category: 'Jobs & calendar',
    question: 'Why doesn’t En Route / On Site update until I refresh?',
    answer:
      'Turn on Feature modules → Live dispatch board. Run supabase/ops-polish.sql once (adds jobs to Supabase Realtime). Keep the Dispatch page open — Drive/Arrive from the tech app updates the board live. Status line shows “● Live” when connected.',
  },
  {
    id: 'capacity-warnings',
    category: 'Jobs & calendar',
    question: 'How do day capacity warnings work?',
    answer:
      'Enable Day capacity warnings. Dispatch columns and Day sheet flag techs over ~8h estimated work and jobs whose scheduled windows overlap (uses scheduled end or est hours). Overlapping cards show an Overlap badge.',
  },
  {
    id: 'offline-queue',
    category: 'Tech app',
    question: 'Can techs save notes and time when offline?',
    answer:
      'Enable Offline notes & time. On a job, Drive/Arrive/Clock Out and Save notes queue in the browser when signal drops, then auto-sync when online (banner shows Sync now). Better than view-only offline — still not a full offline app like Housecall Pro.',
  },
  {
    id: 'skill-dispatch',
    category: 'Jobs & calendar',
    question: 'How does Assign-tech AI work?',
    answer:
      'Turn on Feature modules → Assign-tech AI. Set tech skills in Settings → Tech roster skills. Techs update last location when they tap Drive or Arrive (run supabase/differentiation.sql once). Job site uses the customer’s last check-in GPS when available. On Dispatch, unassigned jobs show Assign for me (top tech + reason from skills + load + proximity) → Confirm to assign. Or pick manually below. Drag onto a tech column still works.',
  },
  {
    id: 'assign-for-me',
    category: 'Jobs & calendar',
    question: 'What is Assign for me on Dispatch?',
    answer:
      'Needs Assign-tech AI on. On an unassigned Dispatch card, Assign for me is the main button — it shows the recommended tech and why. Tap it, then Confirm (or Cancel). Ranking uses skills match, today’s load, and last known location. Manual select and drag-and-drop remain available.',
  },
  {
    id: 'dispatch-board',
    category: 'Jobs & calendar',
    question: 'How do I use the Dispatch board?',
    answer:
      'Enable Dispatch board. Drag jobs onto a tech column or use Reassign. Set Time on a card. Message customers from the card when Customer messaging is on. Pair Live dispatch board for realtime En Route/On Site.',
  },
  {
    id: 'voice-notes',
    category: 'Tech app',
    question: 'How do I turn voice into job notes?',
    answer:
      'Enable AI tools + Job photos & voice. On the job, Record voice note, then Transcribe → notes. Needs OPENAI_API_KEY (Whisper) and XAI_API_KEY (Grok cleanup). Fills diagnosis and customer summary; transcript is saved on the attachment caption.',
  },
  {
    id: 'review-ask',
    category: 'Invoices & PDFs',
    question: 'When does the review ask email go out?',
    answer:
      'Enable Review ask. Set Google / review URL in Company settings. When a job is both Paid and Completed, the customer gets one email with the link (Resend — no Twilio). Triggers on Stripe pay, cash/check paid, clock-out, or signature if the other condition is already met. Needs supabase/differentiation.sql for the review URL column.',
  },
  {
    id: 'messaging-sms',
    category: 'Jobs & calendar',
    question: 'How do OMW / reminder texts work?',
    answer:
      'Enable Customer messaging. On Dispatch or the job, use message buttons (OMW, reminder, confirm). Needs Twilio env vars for real SMS; otherwise sends may simulate and still log. SMS signature is under Company settings.',
  },
  {
    id: 'pm-automation',
    category: 'Jobs & calendar',
    question: 'Can EasyDispatch auto-create PM jobs from agreements?',
    answer:
      'Yes. Enable Service agreements and PM job automation (automation is off by default). Active agreements with next due date today or earlier get a Scheduled Maintenance/PM job overnight; next due advances by visits/year. You can still Create PM manually on Agreements.',
  },
  {
    id: 'service-agreements',
    category: 'Jobs & calendar',
    question: 'Where are service agreements / memberships?',
    answer:
      'Enable Service agreements → Office → Agreements. Create PM plans, set visits/year and next due, Create PM or bill manually. Turn on PM job automation for nightly auto-create.',
  },
  {
    id: 'inventory-po',
    category: 'Jobs & calendar',
    question: 'How do I make a reorder / PO list from low stock?',
    answer:
      'Enable Truck inventory + Reorder / PO list. Set min qty, vendor, and optional reorder qty on items. Inventory shows a reorder panel: Copy PO list or Export PO CSV, Mark ordered. Run supabase/workflow-depth.sql if vendor fields are missing.',
  },
  {
    id: 'part-orders',
    category: 'Jobs & calendar',
    question: 'How do special-order parts work?',
    answer:
      'Enable Special-order parts. Office → Parts, or the Parts panel on a job. Move items Needed → Ordered → Received → Installed.',
  },
  {
    id: 'equipment-timeline',
    category: 'Customers',
    question: 'Where is the equipment timeline and PM checklist?',
    answer:
      'Enable Feature modules → Equipment timeline. On a job (office or tech): PM checklist after Equipment → Use on job. Same checklist on customer → Equipment timeline. Edit items to add/remove custom checks. Add photo per item — on a job those photos also go to Job photos (tag PM). Saved on the unit. Needs supabase/workflow-depth.sql for pm_checklist.',
  },
  {
    id: 'pm-checklist-photos',
    category: 'Tech app',
    question: 'How do PM checklist photos and custom items work?',
    answer:
      'Needs Equipment timeline on. Open the job PM checklist (or customer Equipment timeline) → Edit items to add/remove/rename checks, or Reset defaults. Add photo on any item. On a job, every PM photo also appears in Job photos (tag “PM checklist”). Regular Job photos uploads show there too. Photos stay on the unit checklist for later visits.',
  },
  {
    id: 'technician-view-office',
    category: 'Settings & modules',
    question: 'Can office / owners see the technician app?',
    answer:
      'Yes — Settings → Feature modules → Field / tech → Technician view (office) (on by default). Then in the dashboard header check Tech view, or on a job click Open technician view. Same Arrive → Work → Wrap up screens. Blue banner → Exit to office. Shop jobs list shows assignee names; actions use your office permissions. Turn the module off to hide the toggle for everyone.',
  },
  {
    id: 'ai-walkthrough',
    category: 'Tech app',
    question: 'What is AI Job Walkthrough?',
    answer:
      'Settings → Feature modules → AI Job Walkthrough (panel) + AI tools (Generate). On the tech Work phase, Record video walkthrough is the main CTA (“Film + narrate — AI writes the report”); Extra photos stays collapsed below. Generate: app extracts frames (Grok sees) and Whisper-transcribes audio (Grok hears), then fills findings/work/parts/recommendations/customer summary. Then Apply & wrap up (or Save only). Vercel env: XAI_API_KEY + OPENAI_API_KEY (required for video hear). PDF needs PDF documents. SQL: ai-walkthrough.sql + ai-walkthrough-video.sql if needed.',
  },
  {
    id: 'apply-wrap-up',
    category: 'Tech app',
    question: 'What is Apply & wrap up on a walkthrough?',
    answer:
      'After Generate (or when editing a report), Apply & wrap up saves the walkthrough to the job — findings → diagnosis, customer summary, and parts/labor line items — then opens the Wrap up phase so you can Clock out, get a signature, and invoice. It does not clock you out automatically. Save only applies the same data but stays on Work. On an already-saved walkthrough, use Continue to Wrap up.',
  },
  {
    id: 'ai-walkthrough-video',
    category: 'Tech app',
    question: 'How do I record a video job walkthrough?',
    answer:
      'Needs AI Job Walkthrough on (Settings → Feature modules). Open the job → Work phase → Record video walkthrough (hero button) — this opens your phone’s Camera app (not an in-browser recorder). Film and narrate, then Use/Save video; it uploads to the job. Or use More capture options (voice / library). Keep clips under ~90s / ~80MB. Then Generate Report (AI tools + XAI_API_KEY), then Apply & wrap up. If upload errors mention kind/check, run supabase/ai-walkthrough-video.sql.',
  },
  {
    id: 'ai-walkthrough-pdf',
    category: 'Invoices & PDFs',
    question: 'How do I download a Job Walkthrough PDF?',
    answer:
      'Settings → Feature modules: turn on AI Job Walkthrough and PDF documents. On a job with a generated or saved walkthrough, tap Download PDF. Branded with company info, findings, work performed, parts, labor, and totals. Turning either module off hides the PDF button.',
  },
  {
    id: 'customer-portal-rich',
    category: 'Invoices & PDFs',
    question: 'What can customers see in the portal?',
    answer:
      'Customer portal module on: from the customer profile, Customer portal link opens their account — open job status, pending estimates (Approve), unpaid invoices (Pay online if Stripe link exists), and recent completed jobs. Separate estimate/invoice token links still work for single documents. Run workflow-depth.sql so purpose “customer” is allowed.',
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
      'On New job, click Customer to browse or search by name, city, or phone (or use AI ticket fill to match from call notes). From a customer profile, New job pre-fills that customer. Double-click a site/property — or New job on that site — to start a job for that address. After the job is created, the customer is locked.',
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
      'New jobs default to the next number (#1, #2, #3…) even if Job # stays under More options. Rename anytime on create under More options, or later in Job details → Job # / name (e.g. “River Market Bistro”), then Save.',
  },
  {
    id: 'calendar-drag',
    category: 'Jobs & calendar',
    question: 'How do I reschedule a job on the calendar?',
    answer:
      'Needs Calendar module on. Drag a job onto another day (time of day is kept). Click a job to edit start time and duration (hours), then Save — or Open job for full details.',
  },
  {
    id: 'day-sheet',
    category: 'Jobs & calendar',
    question: 'What is the day sheet?',
    answer:
      'Needs Day sheet module. Office Day sheet shows each tech’s stops for a day. With PDF documents on: Print PDF for the morning huddle. Techs get Today’s run sheet PDF on My jobs for their assigned stops today.',
  },
  {
    id: 'callback-revisit',
    category: 'Jobs & calendar',
    question: 'How do I schedule a callback revisit?',
    answer:
      'Needs Callbacks & warranty module. Open Callbacks → Schedule revisit on a flagged job or auto-detected revisit. Opens New job for that customer (and site if known) with Callback type and callback flag checked.',
  },
  {
    id: 'ai-ticket',
    category: 'Jobs & calendar',
    question: 'What does AI ticket fill do?',
    answer:
      'On New job (AI tools module on), the Fastest path block is at the top: paste or dictate call notes → Fill ticket with AI. Grok drafts job type, priority, diagnosis, notes, and may match an existing customer. Review fields below, then Create job. Schedule, assign, and other details are under More options.',
  },
  {
    id: 'create-job-quickly',
    category: 'Jobs & calendar',
    question: 'How do I create a job quickly?',
    answer:
      'Office → New job. With AI tools on: paste call notes → Fill ticket with AI → review → Create (~30 seconds). Without AI: pick customer + job type (+ diagnosis notes), then Create. Job #, assigned tech, schedule, and priority are under More options (defaults apply if you leave them closed). Line items are added after create.',
  },
  {
    id: 'job-assistant',
    category: 'Jobs & calendar',
    question: 'What is the Job assistant on an office job?',
    answer:
      'Needs AI tools on (Settings → Feature modules). Open any office job (/dashboard/jobs/…). Job assistant sits near the top — ask about that ticket only: draft customer SMS/email, what’s still missing to invoice or collect payment, summarize for the owner, or next office steps. Answers use job notes, line items, invoice/payment status, messages, and walkthrough data. Separate from the floating Help bot (product FAQ). Needs XAI_API_KEY.',
  },
  {
    id: 'pricebook',
    category: 'Estimates',
    question: 'How do I use the pricebook?',
    answer:
      'Enable Pricebook → Office → Pricebook. Add flat-rate items with sell price, your cost, and item type. Import CSV if needed. Presets speed estimates and jobs; costs feed Job costing when that module is on.',
  },
  {
    id: 'job-costing-where',
    category: 'Job costing & reports',
    question: 'Where is job costing? I only see Settings and Reports.',
    answer:
      'No separate “Job Costing” nav tab — turn on Settings → Feature modules → Job costing & profit. Then: Settings → Job costing (wages, target margin, weekly digest); each job’s Sold/Cost/Profit panel; estimate P&L before send; Reports profit KPIs; Export job costing / tech P&L CSV; truck-stock deduct adds costed parts lines.',
  },
  {
    id: 'job-costing-how',
    category: 'Job costing & reports',
    question: 'How do I set up job costing so numbers are right?',
    answer:
      '1) Enable Job costing & profit. 2) Settings → Job costing: target margin, burden, labor $/hr, overhead, optional weekly digest. 3) Tech wages. 4) Pricebook Cost + Sell + type. 5) Cost $ on job lines (inventory deduct fills cost). 6) Clock hours + wage = labor. Save lines to refresh P&L. Review estimate P&L before quoting.',
  },
  {
    id: 'costing-export-digest',
    category: 'Job costing & reports',
    question: 'How do I export job costing CSV or get a weekly profit email?',
    answer:
      'Needs Job costing & Accounting export modules. Export → date range → Job costing (P&L) or Tech P&L summary. Weekly digest: Settings → Job costing → enable Weekly owner profit digest + email. Mondays email last week’s sold/cost/profit (needs Resend on the server).',
  },
  {
    id: 'margin-coach',
    category: 'Job costing & reports',
    question: 'What is AI margin coach and Ask Reports?',
    answer:
      'Job costing + AI tools on: AI margin coach on a job suggests how to hit target margin. Reports + AI: Ask Reports answers plain-English questions about the date range. Office job page also has Job assistant (draft texts, invoice gaps, owner summary) when AI tools is on. Help bot also uses AI tools.',
  },
  {
    id: 'reports-vs-costing',
    category: 'Job costing & reports',
    question: 'What’s on the Reports page?',
    answer:
      'Reports module: paid revenue, unpaid, AR aging, avg ticket, hours, estimate close rate, tech productivity. Job costing on: gross profit, total cost, avg margin, below-target jobs, profit by tech/type, lowest-profit jobs; links to Costing settings and Export CSV.',
  },
  {
    id: 'estimates-on-jobs',
    category: 'Estimates',
    question: 'How do estimates link to jobs?',
    answer:
      'Estimates module: from a job → New estimate (office) or Build estimate (tech). Apply approved lines to the job. With job costing on, estimates show projected P&L before you send.',
  },
  {
    id: 'gbb-packages',
    category: 'Estimates',
    question: 'What is Good / Better / Best (GBB)?',
    answer:
      'Enable Feature modules → Good / Better / Best. From Estimates, open Good / Better / Best to build multi-option packages customers can choose (often with the customer portal). Turn the module off to hide GBB if you only use single estimates.',
  },
  {
    id: 'invoice-send',
    category: 'Invoices & PDFs',
    question: 'How do I send an invoice or take payment?',
    answer:
      'Enable Invoices & payments. On the job invoice panel or Invoices list: send by email/SMS, open Stripe pay link, or mark cash/check paid. Branded PDF needs PDF documents on.',
  },
  {
    id: 'invoice-pdf',
    category: 'Invoices & PDFs',
    question: 'How do I download a branded invoice PDF?',
    answer:
      'Turn on Invoices & payments and PDF documents under Feature modules. On a job invoice panel or Invoices list, tap PDF — downloads a branded PDF (company info, line items, totals) for your bookkeeper or customer.',
  },
  {
    id: 'pdf-day-run',
    category: 'Invoices & PDFs',
    question: 'How do day sheet and tech run sheet PDFs work?',
    answer:
      'PDF documents module on. Office: Day sheet → Print PDF; Invoices → PDF; Job → Job Walkthrough → Download PDF (also needs AI Job Walkthrough). Tech: My jobs → Today’s run sheet PDF; job walkthrough PDF on assigned jobs. Turn PDF documents off to hide all PDF download buttons.',
  },
  {
    id: 'tech-estimate',
    category: 'Tech app',
    question: 'Can technicians create estimates?',
    answer:
      'Yes if Estimates is enabled and the tech has “Build estimates on jobs” (default on). Open an assigned job → Build estimate. Techs only edit estimates on their assigned jobs.',
  },
  {
    id: 'tech-run-sheet',
    category: 'Tech app',
    question: 'Where is my printable run sheet?',
    answer:
      'Tech home (My jobs) shows Next up, then Today/Later/Done; Today’s run sheet PDF when PDF documents is enabled. For the full digital run sheet, open Next up or an assigned job (Arrive → Work → Wrap up).',
  },
  {
    id: 'tech-safety',
    category: 'Tech app',
    question: 'Where is the safety checklist?',
    answer:
      'Enable Safety checklist. On an assigned job → Safety checklist (lockout, ladder, refrigerant, permit). Tech needs the Safety permission under Role permissions.',
  },
  {
    id: 'tech-permissions',
    category: 'Tech app',
    question: 'How do I control what techs can do?',
    answer:
      'Settings → Role permissions for time tracking, notes, media, estimates, invoices, line items, etc. Job cost visibility: Settings → Job costing → “Techs can see job cost / margin”. Feature modules still hide whole categories for the company.',
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

/** All FAQ items: core Q&A + one entry per Feature module toggle. */
export const FAQ_ITEMS: FaqItem[] = [...CORE_FAQ_ITEMS, ...MODULE_FAQ_ITEMS];

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
  const catalog = COMPANY_MODULES.map(
    (m, i) =>
      `M${i + 1}. Module “${m.label}” [${m.group}]: ${m.description} ${m.help}`
  ).join('\n');

  const faqs = FAQ_ITEMS.filter((f) => !f.id.startsWith('module-')).map(
    (f, i) => `${i + 1}. Q: ${f.question}\nA: ${f.answer}`
  ).join('\n\n');

  return `FEATURE MODULES (Settings → Feature modules — toggle any of these):\n${catalog}\n\nFAQ:\n${faqs}`;
}
