import { z } from 'zod';

export const JOB_STATUSES = [
  'New',
  'Scheduled',
  'In Progress',
  'Completed',
  'Cancelled',
] as const;

export const JOB_PRIORITIES = ['Low', 'Medium', 'High', 'Emergency'] as const;

export const jobSchema = z.object({
  customer_id: z.string().uuid('Select a customer'),
  job_number: z
    .string()
    .trim()
    .max(80, 'Job # / name is too long')
    .optional()
    .or(z.literal('')),
  property_id: z.string().uuid().optional().or(z.literal('')),
  equipment_id: z.string().uuid().optional().or(z.literal('')),
  job_type: z.string().trim().min(1, 'Job type is required').max(200),
  priority: z.enum(JOB_PRIORITIES),
  status: z.enum(JOB_STATUSES),
  assigned_to: z.string().uuid().optional().or(z.literal('')),
  diagnosis: z.string().trim().max(10000).optional().or(z.literal('')),
  est_hours: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 999),
      'Invalid hours'
    ),
  scheduled_start: z.string().trim().optional().or(z.literal('')),
  tax_rate_id: z.string().trim().min(1, 'Tax rate is required'),
  notes: z.string().trim().max(10000).optional().or(z.literal('')),
  internal_notes: z.string().trim().max(10000).optional().or(z.literal('')),
  customer_summary: z.string().trim().max(10000).optional().or(z.literal('')),
  is_callback: z.boolean().optional(),
  warranty_flag: z.boolean().optional(),
});

export const lineItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().trim().min(1, 'Description required').max(500),
  qty: z.number().min(0).max(99999),
  unit_price: z.number().min(0).max(999999),
  unit_cost: z.number().min(0).max(999999).optional(),
  item_type: z.enum(['labor', 'parts', 'other']).optional(),
  taxable: z.boolean(),
  sort_order: z.number().int().min(0).optional(),
});

export const lineItemsPayloadSchema = z.object({
  tax_rate_id: z.string().trim().min(1),
  items: z.array(lineItemSchema).max(200),
});

export type JobInput = z.infer<typeof jobSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
