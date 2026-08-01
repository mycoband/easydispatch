import { NextResponse } from 'next/server';
import { ensureProfile, isOfficeRole } from '@/lib/auth';
import { companyAddressLine, loadCompanySettings } from '@/lib/company';
import {
  computeWalkthroughTotals,
  normalizeWalkthrough,
} from '@/lib/jobs/walkthrough';
import { WalkthroughDocument } from '@/lib/pdf/WalkthroughDocument';
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
  if (!company.modules.ai_walkthrough) {
    return NextResponse.json(
      { error: 'AI Job Walkthrough is disabled in Feature modules.' },
      { status: 403 }
    );
  }
  if (!company.modules.print_pdfs) {
    return NextResponse.json(
      { error: 'PDF documents are disabled in Feature modules.' },
      { status: 403 }
    );
  }

  let { data: job, error } = await supabase
    .from('jobs')
    .select(
      'id, job_number, job_type, customer_name, customer_id, property_id, assigned_to, walkthrough'
    )
    .eq('id', jobId)
    .maybeSingle();

  if (error && /walkthrough|column|schema cache/i.test(error.message)) {
    return NextResponse.json(
      {
        error:
          'Walkthrough column missing. Run supabase/ai-walkthrough.sql in Supabase.',
      },
      { status: 400 }
    );
  }

  if (error || !job) {
    return NextResponse.json(
      { error: error?.message || 'Job not found' },
      { status: 404 }
    );
  }

  if (profile.role === 'technician' && job.assigned_to !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const walkthrough = normalizeWalkthrough(
    (job as { walkthrough?: unknown }).walkthrough
  );
  const hasBody =
    Boolean(walkthrough.findings?.trim()) ||
    Boolean(walkthrough.work_performed?.trim()) ||
    Boolean(walkthrough.recommendations?.trim()) ||
    Boolean(walkthrough.customer_summary?.trim()) ||
    walkthrough.parts.length > 0;

  if (!hasBody) {
    return NextResponse.json(
      { error: 'No walkthrough report to export yet' },
      { status: 400 }
    );
  }

  const [{ data: customer }, { data: property }] = await Promise.all([
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

  const totals = computeWalkthroughTotals(walkthrough);

  const doc = (
    <WalkthroughDocument
      companyName={company.name}
      companyLegalName={company.legal_name}
      companyPhone={company.phone}
      companyEmail={company.email}
      companyAddress={companyAddressLine(company)}
      licenseNumber={company.license_number}
      brandColor={company.brand_color}
      jobNumber={job.job_number}
      customerName={job.customer_name}
      customerAddress={customerAddress || null}
      jobType={job.job_type}
      findings={walkthrough.findings}
      workPerformed={walkthrough.work_performed}
      recommendations={walkthrough.recommendations}
      customerSummary={walkthrough.customer_summary}
      parts={walkthrough.parts}
      laborHours={walkthrough.labor_hours}
      laborRate={walkthrough.labor_rate}
      partsTotal={walkthrough.parts_total ?? totals.parts_total}
      laborTotal={totals.labor_total}
      grandTotal={walkthrough.total_estimated ?? totals.total_estimated}
      generatedAt={walkthrough.generated_at}
      savedAt={walkthrough.saved_at}
    />
  );

  const bytes = await renderPdf(doc);
  const filename = `walkthrough-${job.job_number || job.id.slice(0, 8)}.pdf`;

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
