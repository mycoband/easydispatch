export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = 'owner' | 'dispatcher' | 'technician' | 'office';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: AppRole;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: AppRole;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          role?: AppRole;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          company_id: string | null;
          name: string;
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          phone: string | null;
          email: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          name: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          name?: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      equipment: {
        Row: {
          id: string;
          customer_id: string;
          name: string | null;
          equipment_type: string | null;
          manufacturer: string | null;
          model: string | null;
          serial_number: string | null;
          capacity: string | null;
          electrical: string | null;
          refrigerant: string | null;
          filter_size: string | null;
          filter_qty: number | null;
          notes: string | null;
          photo_url: string | null;
          install_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          name?: string | null;
          equipment_type?: string | null;
          manufacturer?: string | null;
          model?: string | null;
          serial_number?: string | null;
          capacity?: string | null;
          electrical?: string | null;
          refrigerant?: string | null;
          filter_size?: string | null;
          filter_qty?: number | null;
          notes?: string | null;
          photo_url?: string | null;
          install_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          name?: string | null;
          equipment_type?: string | null;
          manufacturer?: string | null;
          model?: string | null;
          serial_number?: string | null;
          capacity?: string | null;
          electrical?: string | null;
          refrigerant?: string | null;
          filter_size?: string | null;
          filter_qty?: number | null;
          notes?: string | null;
          photo_url?: string | null;
          install_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'equipment_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      jobs: {
        Row: {
          id: string;
          job_number: string | null;
          customer_id: string | null;
          customer_name: string | null;
          equipment_id: string | null;
          job_type: string | null;
          priority: string;
          status: string;
          assigned_to: string | null;
          assigned_to_name: string | null;
          diagnosis: string | null;
          est_hours: number | null;
          actual_hours: number | null;
          scheduled_start: string | null;
          scheduled_end: string | null;
          drive_started_at: string | null;
          check_in_at: string | null;
          check_out_at: string | null;
          check_in_lat: number | null;
          check_in_lng: number | null;
          tax_rate_id: string | null;
          tax_rate: number;
          subtotal: number;
          tax_amount: number;
          total: number;
          invoice_status: 'Not Sent' | 'Sent';
          invoice_sent_at: string | null;
          payment_status: string;
          payment_method: string | null;
          stripe_payment_id: string | null;
          stripe_payment_link: string | null;
          notes: string | null;
          internal_notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_number?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          equipment_id?: string | null;
          job_type?: string | null;
          priority?: string;
          status?: string;
          assigned_to?: string | null;
          assigned_to_name?: string | null;
          diagnosis?: string | null;
          est_hours?: number | null;
          actual_hours?: number | null;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
          drive_started_at?: string | null;
          check_in_at?: string | null;
          check_out_at?: string | null;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          tax_rate_id?: string | null;
          tax_rate?: number;
          subtotal?: number;
          tax_amount?: number;
          total?: number;
          invoice_status?: 'Not Sent' | 'Sent';
          invoice_sent_at?: string | null;
          payment_status?: string;
          payment_method?: string | null;
          stripe_payment_id?: string | null;
          stripe_payment_link?: string | null;
          notes?: string | null;
          internal_notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          job_number?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          equipment_id?: string | null;
          job_type?: string | null;
          priority?: string;
          status?: string;
          assigned_to?: string | null;
          assigned_to_name?: string | null;
          diagnosis?: string | null;
          est_hours?: number | null;
          actual_hours?: number | null;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
          drive_started_at?: string | null;
          check_in_at?: string | null;
          check_out_at?: string | null;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          tax_rate_id?: string | null;
          tax_rate?: number;
          subtotal?: number;
          tax_amount?: number;
          total?: number;
          invoice_status?: 'Not Sent' | 'Sent';
          invoice_sent_at?: string | null;
          payment_status?: string;
          payment_method?: string | null;
          stripe_payment_id?: string | null;
          stripe_payment_link?: string | null;
          notes?: string | null;
          internal_notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tax_rates: {
        Row: {
          id: string;
          name: string;
          rate: number;
          region: string | null;
        };
        Insert: {
          id: string;
          name: string;
          rate: number;
          region?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          rate?: number;
          region?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
