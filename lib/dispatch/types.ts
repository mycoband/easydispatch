export type DispatchTech = {
  id: string;
  full_name: string | null;
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
  est_hours: number | null;
  internal_notes: string | null;
  drive_started_at: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  invoice_status: string | null;
  payment_status: string | null;
  phone: string | null;
  address: string | null;
};
