export const EXPORT_KINDS = [
  'paid',
  'unpaid',
  'customers',
  'job_costing',
  'tech_pnl',
  'timesheets',
] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];
