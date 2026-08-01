import { z } from 'zod';

export const EQUIPMENT_TYPES = [
  'RTU',
  'Condenser',
  'Furnace',
  'Air Handler',
  'Heat Pump',
  'Boiler',
  'Mini-Split',
  'Walk-in Cooler',
  'Walk-in Freezer',
  'Other',
] as const;

export const equipmentSchema = z.object({
  name: z.string().trim().max(80).optional().or(z.literal('')),
  equipment_type: z.string().trim().min(1, 'Type is required').max(80),
  manufacturer: z.string().trim().max(120).optional().or(z.literal('')),
  model: z.string().trim().max(120).optional().or(z.literal('')),
  serial_number: z.string().trim().max(120).optional().or(z.literal('')),
  capacity: z.string().trim().max(80).optional().or(z.literal('')),
  electrical: z.string().trim().max(120).optional().or(z.literal('')),
  refrigerant: z.string().trim().max(80).optional().or(z.literal('')),
  filter_size: z.string().trim().max(80).optional().or(z.literal('')),
  filter_qty: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => !v || (/^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 99),
      'Filter qty must be a number 0–99'
    ),
  install_date: z.string().trim().optional().or(z.literal('')),
  property_id: z.string().uuid().optional().or(z.literal('')),
  warranty_parts_expires: z.string().trim().optional().or(z.literal('')),
  warranty_labor_expires: z.string().trim().optional().or(z.literal('')),
  warranty_notes: z.string().trim().max(2000).optional().or(z.literal('')),
  notes: z.string().trim().max(5000).optional().or(z.literal('')),
});

export type EquipmentInput = z.infer<typeof equipmentSchema>;

export function parseFilterQty(value?: string | null): number | null {
  const v = value?.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
