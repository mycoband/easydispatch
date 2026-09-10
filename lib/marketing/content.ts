export const VALUE_PROPS = [
  {
    title: 'Dispatch that ranks, you confirm',
    body: 'Assign for me scores techs by skills, day load, and location. The office still taps Confirm — it is a recommendation, not an autopilot.',
  },
  {
    title: 'The shop line can take a ticket',
    body: 'AI receptionist answers SMS and phone, collects name, address, and the problem, then opens an undated job. Your team schedules it.',
  },
  {
    title: 'A run sheet techs can finish',
    body: 'My jobs leads with Next up. Arrive → Work → Wrap up keeps the stop moving: notes, photos, safety, walkthrough, then invoice steps you still send.',
  },
  {
    title: 'See what a job actually made',
    body: 'Job costing, reports, and an AI margin coach sit next to invoices and estimates — so pricing is not a guess after the truck leaves.',
  },
] as const;

export const HOW_IT_WORKS = [
  {
    eyebrow: 'Office',
    title: 'Take the call, board the day',
    body: 'Intake lands as a job — typed in, imported, or drafted by the AI receptionist. Calendar and day capacity show who is overbooked. Dispatch assigns a tech (or Assign for me suggests one). Customers get OMW and reminder drafts you choose to send.',
  },
  {
    eyebrow: 'Technician',
    title: 'Run the stop, capture the work',
    body: 'My jobs is the run sheet. Arrive, do the work, wrap up. Voice-to-notes and AI Job Walkthrough turn the visit into a write-up. Offline notes and time queue when the signal drops. Photos and the safety checklist stay on the ticket.',
  },
  {
    eyebrow: 'Back at the shop',
    title: 'Price it, collect, learn',
    body: 'Good / Better / Best estimates, pricebook, invoices, and payments close the job. Service agreements spawn PM work. Reports and margin coach show which work is worth repeating.',
  },
] as const;

export const MARKETING_FAQ = [
  {
    question: 'What is EasyDispatch?',
    answer:
      'AI-first HVAC field service software: an office dashboard for dispatch, customers, estimates, invoices, and costing, plus a technician app for assigned jobs. Feature modules let each shop turn categories on or off.',
  },
  {
    question: 'Is the technician app a separate product?',
    answer:
      'No. Office and tech share one account. Techs open My jobs; office staff can optionally use Technician view to see the same Arrive / Work / Wrap up screens.',
  },
  {
    question: 'Do you have iPhone, Android, or Windows apps?',
    answer:
      'The web app is live and installable as a PWA (Add to Home Screen / Install). Native Android, Windows, and iOS wrappers are planned — coming soon. There are no store listings yet.',
  },
  {
    question: 'How does pricing work?',
    answer:
      'Starter and Pro are self-serve from Settings → Billing after you sign in. Enterprise is listed for later. Create a company to start a 14-day trial. See the Pricing page for the current plan list.',
  },
  {
    question: 'Will it replace my current software overnight?',
    answer:
      'You can import customers and pricebook items from Housecall Pro or CSV, then turn on only the modules you need. AI drafts tickets and texts — people still confirm assigns, send messages, and send invoices.',
  },
] as const;

export const OFFICE_FEATURES = [
  {
    title: 'Dispatch board & live dispatch',
    body: 'Assign techs and watch En Route / On Site without refreshing. Drag jobs between columns on phone or desktop.',
  },
  {
    title: 'Assign-tech AI + Assign for me',
    body: 'Ranks techs by skills, load, and location, then waits for Confirm. Manual assign is always available.',
  },
  {
    title: 'AI receptionist',
    body: 'Answers the shop SMS and phone line, then creates an undated customer + job. Office schedules — it does not auto-book the calendar.',
  },
  {
    title: 'Calendar & day capacity',
    body: 'Week/month board with drag-between-days. Capacity warnings flag overbooked techs and overlapping windows.',
  },
  {
    title: 'Customers + multi-site',
    body: 'Customer records with multiple properties, equipment, and job history. Search from the office and on new jobs.',
  },
  {
    title: 'Equipment timeline & PM checklists',
    body: 'Per-unit history, editable PM checks, and item photos that also land on the job.',
  },
  {
    title: 'Service agreements & PM automation',
    body: 'Memberships and PM plans with next-due dates. Optional nightly job creates maintenance when a plan is due.',
  },
  {
    title: 'Estimates — Good / Better / Best',
    body: 'Quotes with line items, estimated P&L, and multi-option install packages customers can pick in the portal.',
  },
  {
    title: 'Pricebook',
    body: 'Flat-rate presets with sell price, your cost, and item type. Costs feed job costing when that module is on.',
  },
  {
    title: 'Invoices & payments',
    body: 'Send invoices, Stripe pay links, or mark cash/check. Branded PDF when PDF documents is enabled.',
  },
  {
    title: 'Job costing, reports & AI margin coach',
    body: 'Sold / cost / profit on the job, profit KPIs on Reports, Ask Reports, and a margin coach for pricing conversations.',
  },
  {
    title: 'Customer messaging',
    body: 'On-my-way, done, reminders, and confirm links. Drafts are prefilled — EasyDispatch does not auto-send.',
  },
  {
    title: 'Customer portal',
    body: 'A customer link for job status, history, estimate approval, and invoice pay — plus single-document token links.',
  },
  {
    title: 'Review ask',
    body: 'After a job is paid and completed, email a Google/review link once. Configure the URL in company settings.',
  },
  {
    title: 'Housecall Pro / CSV import',
    body: 'Bring customers and pricebook items over when you switch. Imports live under Customers and Pricebook.',
  },
  {
    title: 'Truck inventory, reorder & special-order parts',
    body: 'Stock on trucks, low-stock reorder / PO list, and special-order parts from needed → installed, including pick-ticket photos.',
  },
  {
    title: 'PDF day sheets & invoices',
    body: 'Morning huddle day-sheet PDF, tech run-sheet PDF, branded invoices, and AI Job Walkthrough PDFs.',
  },
] as const;

export const TECH_FEATURES = [
  {
    title: 'My jobs / run sheet',
    body: 'Next up on top, then Today / Later / Done. Printable run-sheet PDF when PDFs are on.',
  },
  {
    title: 'Arrive / Work / Wrap up',
    body: 'Three phases on the ticket. Arrive opens Work; clock-out opens Wrap. Finish this stop lists signature, price, and send — you still tap Send.',
  },
  {
    title: 'Offline notes & time',
    body: 'Queue diagnosis notes and Drive / Arrive / Clock out when signal drops; sync when you are back.',
  },
  {
    title: 'Voice-to-notes',
    body: 'Record a voice note, transcribe, and drop it into the job notes (AI tools on).',
  },
  {
    title: 'AI Job Walkthrough',
    body: 'Short on-job video, voice, or photos → Generate a report → Apply & wrap up. Review before you rely on it.',
  },
  {
    title: 'Photos',
    body: 'Before/after and extra job photos, plus equipment/PM photos that attach to the unit timeline.',
  },
  {
    title: 'Safety checklist',
    body: 'Lockout, ladder, refrigerant, and permit checks on the Work phase when the module and permission are on.',
  },
  {
    title: 'OMW / Done drafts',
    body: 'Drive start offers an On My Way text; clock-out offers a Done draft. Send or skip — nothing goes out alone.',
  },
] as const;

export const PLATFORMS = [
  {
    name: 'Web & PWA',
    status: 'Live',
    body: 'Use EasyDispatch in the browser, or install it to the home screen on Windows, Mac, Android, and iPhone. Same office and tech screens.',
  },
  {
    name: 'Android',
    status: 'Coming soon',
    body: 'A native Play Store wrapper is planned. Until then, Chrome → Install / Add to Home screen.',
  },
  {
    name: 'Windows',
    status: 'Coming soon',
    body: 'A native Windows build is planned. Chrome or Edge can Install EasyDispatch as an app today.',
  },
  {
    name: 'iOS',
    status: 'Coming soon',
    body: 'A native App Store wrapper is planned. Safari → Share → Add to Home Screen works now.',
  },
] as const;
