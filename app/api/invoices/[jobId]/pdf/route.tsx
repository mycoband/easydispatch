import { NextResponse } from 'next/server';
import { ensureProfile, isOfficeRole } from '@/lib/auth';
import {
  companyAddressLine,
  loadCompanySettings,
} from '@/lib/company';
import { InvoiceDocument } from '@/lib/pdf/InvoiceDocument';
import { renderPdf } from '@/lib/pdf/render';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: 'Missing job' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await ensureProfile(user);
  if (!isOfficeRole(profile.role) && profile.role !== 'technician') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const company = await loadCompanySettings();
  if (!company.modules.invoices || !company.modules.print_pdfs) {
    return NextResponse.json(
      { error: 'Invoice PDFs are disabled in Feature modules.' },
      { status: 403 }
    );
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .select(
      'id, job_number, customer_name, customer_id, property_id, assigned_to, subtotal, tax_amount, total, invoice_status, payment_status, invoice_sent_at, created_at'
    )
    .eq('id', jobId)
    .maybeSingle();

  if (error || !job) {
    return NextResponse.json(
      { error: error?.message || 'Job not found' },
      { status: 404 }
    );
  }

  if (profile.role === 'technician' && job.assigned_to !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [{ data: lines }, { data: customer }, { data: property }] =
    await Promise.all([
      supabase
        .from('line_items')
        .select('description, qty, unit_price, taxable, sort_order')
        .eq('job_id', jobId)
        .order('sort_order', { ascending: true }),
      job.customer_id
        ? supabase
            .from('customers')
            .select('address, city, state, zip')
            .eq('id', job.customer_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      job.property_id
        ? supabase
            .from('properties')
            .select('address, city, state, zip')
            .eq('id', job.property_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const addr = property || customer;
  const customerAddress = addr
    ? [addr.address, addr.city, addr.state, addr.zip].filter(Boolean).join(', ')
    : '';

  const doc = (
    <InvoiceDocument
      companyName={company.name}
      companyLegalName={company.legal_name}
      companyPhone={company.phone}
      companyEmail={company.email}
      companyAddress={companyAddressLine(company)}
      licenseNumber={company.license_number}
      brandColor={company.brand_color}
      invoiceFooter={company.invoice_footer}
      jobNumber={job.job_number}
      customerName={job.customer_name}
      customerAddress={customerAddress || null}
      invoiceStatus={job.invoice_status}
      paymentStatus={job.payment_status}
      subtotal={Number(job.subtotal) || 0}
      taxAmount={Number(job.tax_amount) || 0}
      total={Number(job.total) || 0}
      lines={(lines ?? []).map((l) => ({
        description: l.description || 'Item',
        qty: Number(l.qty) || 0,
        unit_price: Number(l.unit_price) || 0,
        taxable: Boolean(l.taxable),
      }))}
      issuedAt={job.invoice_sent_at || job.created_at}
    />
  );

  const bytes = await renderPdf(doc);
  const filename = `invoice-${job.job_number || job.id.slice(0, 8)}.pdf`;

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
