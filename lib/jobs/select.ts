/**
 * Explicit job columns for detail pages — omits bulky signature_data by default.
 * Load signature_data separately when SignaturePad needs the PNG.
 *
 * Note: pass to supabase .select() then cast the row — dynamic select strings
 * are not inferred by supabase-js typings.
 */
export const JOB_DETAIL_COLUMNS = [
  'id',
  'company_id',
  'job_number',
  'customer_id',
  'customer_name',
  'equipment_id',
  'property_id',
  'job_type',
  'priority',
  'status',
  'confirmation_status',
  'assigned_to',
  'assigned_to_name',
  'diagnosis',
  'customer_summary',
  'est_hours',
  'actual_hours',
  'scheduled_start',
  'scheduled_end',
  'drive_started_at',
  'check_in_at',
  'check_out_at',
  'check_in_lat',
  'check_in_lng',
  'tax_rate_id',
  'tax_rate',
  'subtotal',
  'tax_amount',
  'total',
  'invoice_status',
  'invoice_sent_at',
  'payment_status',
  'payment_method',
  'stripe_payment_id',
  'stripe_payment_link',
  'notes',
  'internal_notes',
  'is_callback',
  'customer_approved_at',
  'customer_approved_note',
  'signed_at',
  'signature_name',
  'safety_checklist',
  'walkthrough',
  'created_by',
  'created_at',
  'updated_at',
].join(', ');

/** Fallback when walkthrough column is missing from schema cache. */
export const JOB_DETAIL_COLUMNS_NO_WALKTHROUGH = JOB_DETAIL_COLUMNS.replace(
  ', walkthrough',
  ''
);
