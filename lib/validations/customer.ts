import { z } from 'zod';

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state: z.string().trim().max(2).optional().or(z.literal('')),
  zip: z.string().trim().max(12).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  email: z
    .string()
    .trim()
    .email('Invalid email')
    .optional()
    .or(z.literal('')),
  notes: z.string().trim().max(5000).optional().or(z.literal('')),
  access_notes: z.string().trim().max(5000).optional().or(z.literal('')),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export function emptyToNull(value?: string | null) {
  const v = value?.trim();
  return v ? v : null;
}
