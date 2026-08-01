import { z } from 'zod';

export const ESTIMATE_STATUSES = [
  'Draft',
  'Sent',
  'Approved',
  'Rejected',
  'Expired',
] as const;

export const estimateSchema = z.object({
  customer_id: z.string().uuid('Select a customer'),
  description: z.string().trim().min(1, 'Description is required').max(2000),
  status: z.enum(ESTIMATE_STATUSES).default('Draft'),
  tax_rate_id: z.string().min(1),
  valid_until: z.string().optional().nullable(),
});
