/** Common HVAC quote / job line presets for faster office entry. */
export const HVAC_LINE_PRESETS = [
  { label: 'Diagnostic', description: 'Diagnostic / trip charge', qty: 1, unit_price: 89, taxable: true },
  { label: 'Labor hr', description: 'Labor – technician hour', qty: 1, unit_price: 125, taxable: true },
  { label: 'Capacitor', description: 'Run capacitor replacement', qty: 1, unit_price: 185, taxable: true },
  { label: 'Contactor', description: 'Contactor replacement', qty: 1, unit_price: 225, taxable: true },
  { label: 'Filter', description: 'Filter change (standard)', qty: 1, unit_price: 45, taxable: true },
  { label: 'Tune-up', description: 'Seasonal maintenance / tune-up', qty: 1, unit_price: 149, taxable: true },
  { label: 'Drain clear', description: 'Condensate drain clear', qty: 1, unit_price: 95, taxable: true },
  { label: 'TXV / metering', description: 'Metering device / TXV service', qty: 1, unit_price: 350, taxable: true },
] as const;

export const HVAC_JOB_TYPES = [
  'Service call',
  'No cool',
  'No heat',
  'Maintenance / PM',
  'Install',
  'Estimate / quote',
  'Callback',
  'Emergency',
] as const;
