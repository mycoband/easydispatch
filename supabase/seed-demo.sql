-- EasyDispatch KC metro demo data
-- Prerequisites: full SQL stack + at least one company (sign up as owner first).
-- Safe to re-run: removes previous rows tagged notes/internal_notes with [DEMO].

do $$
declare
  cid uuid;
  tech_id uuid;
  c1 uuid := 'a1000001-0000-4000-8000-000000000001';
  c2 uuid := 'a1000001-0000-4000-8000-000000000002';
  c3 uuid := 'a1000001-0000-4000-8000-000000000003';
  c4 uuid := 'a1000001-0000-4000-8000-000000000004';
  p1 uuid := 'b1000001-0000-4000-8000-000000000001';
  p2 uuid := 'b1000001-0000-4000-8000-000000000002';
  p3 uuid := 'b1000001-0000-4000-8000-000000000003';
  p4 uuid := 'b1000001-0000-4000-8000-000000000004';
  e1 uuid := 'c1000001-0000-4000-8000-000000000001';
  e2 uuid := 'c1000001-0000-4000-8000-000000000002';
  e3 uuid := 'c1000001-0000-4000-8000-000000000003';
  j1 uuid := 'd1000001-0000-4000-8000-000000000001';
  j2 uuid := 'd1000001-0000-4000-8000-000000000002';
  j3 uuid := 'd1000001-0000-4000-8000-000000000003';
  j4 uuid := 'd1000001-0000-4000-8000-000000000004';
  j5 uuid := 'd1000001-0000-4000-8000-000000000005';
  inv1 uuid := 'e1000001-0000-4000-8000-000000000001';
  inv2 uuid := 'e1000001-0000-4000-8000-000000000002';
  inv3 uuid := 'e1000001-0000-4000-8000-000000000003';
begin
  select id into cid from public.companies order by created_at limit 1;
  if cid is null then
    raise exception 'No company found. Sign up as owner (Start a company), then re-run seed-demo.sql';
  end if;

  select id into tech_id
  from public.profiles
  where role = 'technician' and (company_id = cid or company_id is null)
  order by created_at
  limit 1;

  -- Wipe prior demo rows (fixed UUIDs)
  delete from public.line_items where job_id in (j1, j2, j3, j4, j5);
  delete from public.job_part_orders where job_id in (j1, j2, j3, j4, j5);
  delete from public.messages where job_id in (j1, j2, j3, j4, j5);
  delete from public.jobs where id in (j1, j2, j3, j4, j5);
  delete from public.equipment where id in (e1, e2, e3);
  delete from public.properties where id in (p1, p2, p3, p4);
  delete from public.service_agreements where customer_id in (c1, c2, c3, c4);
  delete from public.inventory_items where id in (inv1, inv2, inv3);
  delete from public.customers where id in (c1, c2, c3, c4);

  -- Brand the default company for demos
  update public.companies
  set name = coalesce(nullif(name, ''), 'DC Refrigeration'),
      updated_at = now()
  where id = cid;

  update public.company_settings
  set
    name = 'DC Refrigeration',
    phone = '(816) 555-0140',
    email = 'dispatch@dcrefrigeration.example',
    city = 'Kansas City',
    state = 'MO',
    zip = '64108',
    address = '1800 Main St',
    sms_signature = 'DC Refrigeration',
    updated_at = now()
  where company_id = cid or id = 1;

  -- Customers (commercial + residential KC metro)
  insert into public.customers (
    id, company_id, name, address, city, state, zip, phone, email, notes, access_notes
  ) values
    (c1, cid, 'Acme Fitness — Overland Park', '12300 Metcalf Ave', 'Overland Park', 'KS', '66213',
     '(913) 555-0101', 'facilities@acmefitness.example',
     '[DEMO] Preferred AM appointments. Multi-RTU rooftop.',
     'Gate 4321 · ask front desk for roof key'),
    (c2, cid, 'River Market Bistro', '20 E 5th St', 'Kansas City', 'MO', '64106',
     '(816) 555-0188', 'ops@rivermarketbistro.example',
     '[DEMO] Walk-in cooler + dining RTU. Busy lunch — avoid 11:30–1:30.',
     'Alley entrance · code 2210'),
    (c3, cid, 'Smith Residence', '456 Oak St', 'Kansas City', 'MO', '64111',
     '(816) 555-0199', 'jane.smith@example.com',
     '[DEMO] Residential split system. Dog in backyard.',
     'Lockbox 9988'),
    (c4, cid, 'Northland Elementary', '8100 N Oak Trafficway', 'Kansas City', 'MO', '64118',
     '(816) 555-0170', 'facilities@northland.k12.example',
     '[DEMO] School — badge required. PM contract site.',
     'Check in at main office');

  insert into public.properties (
    id, company_id, customer_id, name, address, city, state, zip, access_notes, is_primary
  ) values
    (p1, cid, c1, 'Primary', '12300 Metcalf Ave', 'Overland Park', 'KS', '66213',
     'Gate 4321 · roof key at desk', true),
    (p2, cid, c2, 'Primary', '20 E 5th St', 'Kansas City', 'MO', '64106',
     'Alley · code 2210', true),
    (p3, cid, c3, 'Primary', '456 Oak St', 'Kansas City', 'MO', '64111',
     'Lockbox 9988 · dog in yard', true),
    (p4, cid, c4, 'Primary', '8100 N Oak Trafficway', 'Kansas City', 'MO', '64118',
     'Main office check-in', true);

  insert into public.equipment (
    id, company_id, customer_id, property_id, name, equipment_type, manufacturer, model,
    serial_number, capacity, electrical, refrigerant, filter_size, filter_qty, notes
  ) values
    (e1, cid, c1, p1, 'RTU-1 North', 'RTU', 'Carrier', '48TCFD08', '4911X88721',
     '7.5 Ton', '208/230-3', 'R-410A', '20x25x2', 2, '[DEMO]'),
    (e2, cid, c2, p2, 'Walk-in condenser', 'Condenser', 'Heatcraft', 'BNL050', 'HC88210',
     '1.5 HP', '208-1', 'R-404A', null, null, '[DEMO]'),
    (e3, cid, c3, p3, 'Outdoor condenser', 'Condenser', 'Trane', '4TTR4036', 'TR99102',
     '3 Ton', '230-1', 'R-410A', '16x25x1', 1, '[DEMO]');

  insert into public.inventory_items (
    id, company_id, name, sku, qty_on_hand, min_qty, cost, sell_price, location
  ) values
    (inv1, cid, 'Capacitor 45/5', 'CAP-45-5', 6, 2, 12.50, 48.00, 'Truck 1'),
    (inv2, cid, 'Contactor 40A', 'CNT-40', 3, 2, 18.00, 65.00, 'Truck 1'),
    (inv3, cid, 'Filter 20x25x2 MERV-11', 'FLT-2025-2', 1, 4, 8.00, 28.00, 'Warehouse');

  -- Jobs for today / this week
  insert into public.jobs (
    id, company_id, customer_id, property_id, equipment_id, customer_name, job_type, status, priority,
    assigned_to, assigned_to_name, scheduled_start, tax_rate_id, tax_rate, diagnosis,
    internal_notes, notes, invoice_status, payment_status, subtotal, tax_amount, total
  ) values
    (j1, cid, c1, p1, e1, 'Acme Fitness — Overland Park', 'No cool', 'Scheduled', 'High',
     tech_id, null,
     date_trunc('day', now()) + interval '9 hours',
     'johnson-ks', 0.0935,
     'Rooftop not cooling north zone. Suspect capacitor.',
     '[DEMO] Call office before ladder work on wet roof.',
     null, 'Not Sent', 'Unpaid', 0, 0, 0),
    (j2, cid, c2, p2, e2, 'River Market Bistro', 'Walk-in warm', 'New', 'Emergency',
     null, null,
     date_trunc('day', now()) + interval '11 hours',
     'kcmo-jackson', 0.09975,
     'Walk-in running warm overnight.',
     '[DEMO] Priority — food risk. Text when ETA known.',
     null, 'Not Sent', 'Unpaid', 0, 0, 0),
    (j3, cid, c3, p3, e3, 'Smith Residence', 'Maintenance', 'Scheduled', 'Medium',
     tech_id, null,
     date_trunc('day', now()) + interval '14 hours',
     'kcmo-jackson', 0.09975,
     'Seasonal tune-up + filter change.',
     '[DEMO] Dog friendly if announced.',
     null, 'Not Sent', 'Unpaid', 0, 0, 0),
    (j4, cid, c4, p4, null, 'Northland Elementary', 'PM visit', 'Completed', 'Low',
     tech_id, null,
     date_trunc('day', now()) - interval '2 days' + interval '10 hours',
     'clay', 0.08725,
     'Quarterly PM complete. Coils cleaned.',
     '[DEMO]',
     'All units within range.', 'Sent', 'Unpaid', 450, 39.26, 489.26),
    (j5, cid, c1, p1, e1, 'Acme Fitness — Overland Park', 'Diagnostic', 'Completed', 'Medium',
     tech_id, null,
     date_trunc('day', now()) - interval '5 days' + interval '13 hours',
     'johnson-ks', 0.0935,
     'Replaced dual run capacitor. System cooling.',
     '[DEMO]',
     'Customer approved verbal.', 'Sent', 'Paid', 289, 27.02, 316.02);

  update public.jobs j
  set assigned_to_name = p.full_name
  from public.profiles p
  where j.assigned_to = p.id and j.id in (j1, j3, j4, j5);

  insert into public.line_items (job_id, company_id, description, qty, unit_price, taxable, sort_order)
  values
    (j4, cid, 'Quarterly PM labor', 1, 350, true, 1),
    (j4, cid, 'Filter pack (MERV-11)', 2, 50, true, 2),
    (j5, cid, 'Diagnostic fee', 1, 89, true, 1),
    (j5, cid, 'Capacitor 45/5', 1, 48, true, 2),
    (j5, cid, 'Labor hour', 1.2, 125, true, 3);

  insert into public.job_part_orders (
    id, company_id, job_id, description, sku, vendor, qty, unit_cost, status, notes
  ) values
    (gen_random_uuid(), cid, j2, 'Walk-in TXV 1/2 ton', 'TXV-R404-05', 'Johnstone', 1, 86,
     'needed', '[DEMO] Special order if valve bad'),
    (gen_random_uuid(), cid, j1, 'Dual run capacitor 45/5', 'CAP-45-5', 'Truck stock', 1, 12.5,
     'ordered', '[DEMO]');

  insert into public.service_agreements (
    customer_id, company_id, customer_name, plan_name, visits_per_year,
    monthly_amount, status, next_due_date, notes
  ) values (
    c4, cid, 'Northland Elementary', 'School PM Gold', 4,
    0, 'Active',
    (date_trunc('month', now()) + interval '1 month')::date,
    '[DEMO] Includes filter changes + coil clean'
  );

  -- Ensure a few pricebook rows exist for the company
  insert into public.pricebook_items (company_id, name, description, category, unit_price, taxable, sort_order)
  select cid, x.name, x.description, x.category, x.unit_price, true, x.sort_order
  from (values
    ('Diagnostic fee', 'Trip + first 30 minutes', 'Service', 89::numeric, 10),
    ('Labor hour', 'Additional labor per hour', 'Labor', 125::numeric, 20),
    ('After-hours premium', 'Nights / weekends uplift', 'Labor', 75::numeric, 30)
  ) as x(name, description, category, unit_price, sort_order)
  where not exists (
    select 1 from public.pricebook_items pb
    where pb.company_id = cid and pb.name = x.name
  );

  raise notice 'Demo seed complete for company %. Tech assigned: %', cid, coalesce(tech_id::text, 'none (create a technician)');
end $$;
