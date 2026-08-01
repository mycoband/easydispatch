export type DispatchTech = {
  id: string;
  full_name: string | null;
  skills?: string[];
  last_lat?: number | null;
  last_lng?: number | null;
};

export type DispatchJob = {
  id: string;
  job_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  job_type: string | null;
  status: string | null;
  priority: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  scheduled_start: string | null;
  scheduled_end?: string | null;
  est_hours: number | null;
  internal_notes: string | null;
  drive_started_at: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  invoice_status: string | null;
  payment_status: string | null;
  phone: string | null;
  address: string | null;
  /** Prior visit check-in at this customer (for proximity) */
  site_lat?: number | null;
  site_lng?: number | null;
};
