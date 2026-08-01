import { roundMoney } from '@/lib/jobs/totals';

export type CostingSettings = {
  target_margin_pct: number;
  default_burden_pct: number;
  overhead_per_hour: number;
  overhead_pct_of_revenue: number;
  tech_see_costs: boolean;
  default_labor_cost_per_hour: number;
  /** Monday cron: email last week’s profit summary to owner */
  weekly_digest_enabled: boolean;
  weekly_digest_email: string;
};

export const DEFAULT_COSTING: CostingSettings = {
  target_margin_pct: 55,
  default_burden_pct: 25,
  overhead_per_hour: 0,
  overhead_pct_of_revenue: 0,
  tech_see_costs: false,
  default_labor_cost_per_hour: 35,
  weekly_digest_enabled: false,
  weekly_digest_email: '',
};

export function normalizeCosting(raw: unknown): CostingSettings {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const num = (key: keyof CostingSettings, fallback: number) => {
    const v = src[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
      return Number(v);
    }
    return fallback;
  };
  return {
    target_margin_pct: num('target_margin_pct', DEFAULT_COSTING.target_margin_pct),
    default_burden_pct: num('default_burden_pct', DEFAULT_COSTING.default_burden_pct),
    overhead_per_hour: num('overhead_per_hour', DEFAULT_COSTING.overhead_per_hour),
    overhead_pct_of_revenue: num(
      'overhead_pct_of_revenue',
      DEFAULT_COSTING.overhead_pct_of_revenue
    ),
    tech_see_costs:
      typeof src.tech_see_costs === 'boolean'
        ? src.tech_see_costs
        : DEFAULT_COSTING.tech_see_costs,
    default_labor_cost_per_hour: num(
      'default_labor_cost_per_hour',
      DEFAULT_COSTING.default_labor_cost_per_hour
    ),
    weekly_digest_enabled:
      typeof src.weekly_digest_enabled === 'boolean'
        ? src.weekly_digest_enabled
        : DEFAULT_COSTING.weekly_digest_enabled,
    weekly_digest_email:
      typeof src.weekly_digest_email === 'string'
        ? src.weekly_digest_email.trim()
        : DEFAULT_COSTING.weekly_digest_email,
  };
}

export type CostingLine = {
  qty: number;
  unit_price: number;
  unit_cost: number;
  item_type?: string | null;
};

export type JobCostingInput = {
  lines: CostingLine[];
  /** Pre-tax sold (usually job subtotal); if omitted, sum of line sells */
  revenue?: number;
  actual_hours?: number | null;
  tech_hourly_cost?: number | null;
  tech_burden_pct?: number | null;
  part_order_costs?: number;
  costing: CostingSettings;
};

export type JobCostingResult = {
  revenue: number;
  material_cost: number;
  labor_cost: number;
  overhead_cost: number;
  total_cost: number;
  gross_profit: number;
  margin_pct: number | null;
  below_target: boolean;
  target_margin_pct: number;
  flags: string[];
};

export function laborBurdenedRate(
  hourlyCost: number,
  burdenPct: number
): number {
  return roundMoney(hourlyCost * (1 + Math.max(0, burdenPct) / 100));
}

export function computeJobCosting(input: JobCostingInput): JobCostingResult {
  const flags: string[] = [];
  const revenue = roundMoney(
    input.revenue ??
      input.lines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  );

  const lineMaterial = roundMoney(
    input.lines
      .filter((l) => (l.item_type || 'other') !== 'labor')
      .reduce((s, l) => s + l.qty * (Number(l.unit_cost) || 0), 0)
  );
  const lineLaborCost = roundMoney(
    input.lines
      .filter((l) => (l.item_type || '') === 'labor')
      .reduce((s, l) => s + l.qty * (Number(l.unit_cost) || 0), 0)
  );
  const partOrders = roundMoney(input.part_order_costs || 0);
  const material_cost = roundMoney(lineMaterial + partOrders);

  const hours = Number(input.actual_hours) || 0;
  const wage =
    Number(input.tech_hourly_cost) ||
    input.costing.default_labor_cost_per_hour ||
    0;
  const burden =
    input.tech_burden_pct != null && Number.isFinite(Number(input.tech_burden_pct))
      ? Number(input.tech_burden_pct)
      : input.costing.default_burden_pct;

  let clockLabor = 0;
  if (hours > 0) {
    if (wage <= 0) flags.push('hours_without_wage');
    else clockLabor = roundMoney(hours * laborBurdenedRate(wage, burden));
  }

  // Prefer max of clocked burdened labor vs labor line costs (avoid double-count lightly:
  // use clock when hours exist, else labor lines)
  const labor_cost = hours > 0 ? clockLabor : lineLaborCost;
  if (hours > 0 && lineLaborCost > 0 && Math.abs(clockLabor - lineLaborCost) > 1) {
    flags.push('labor_line_vs_clock_mismatch');
  }

  const overhead_cost = roundMoney(
    hours * (input.costing.overhead_per_hour || 0) +
      revenue * ((input.costing.overhead_pct_of_revenue || 0) / 100)
  );

  const total_cost = roundMoney(material_cost + labor_cost + overhead_cost);
  const gross_profit = roundMoney(revenue - total_cost);
  const margin_pct =
    revenue > 0 ? roundMoney((gross_profit / revenue) * 100) : null;

  const missingCostLines = input.lines.filter(
    (l) =>
      l.qty > 0 &&
      l.unit_price > 0 &&
      (Number(l.unit_cost) || 0) <= 0 &&
      (l.item_type || 'other') !== 'labor'
  );
  if (missingCostLines.length) flags.push('missing_part_costs');
  if (revenue > 0 && total_cost === 0) flags.push('zero_cost_job');

  const target = input.costing.target_margin_pct;
  const below_target =
    margin_pct != null ? margin_pct < target - 0.01 : revenue > 0 && total_cost > 0;

  if (below_target && margin_pct != null) flags.push('below_target_margin');

  return {
    revenue,
    material_cost,
    labor_cost,
    overhead_cost,
    total_cost,
    gross_profit,
    margin_pct,
    below_target,
    target_margin_pct: target,
    flags,
  };
}

export function marginTone(
  marginPct: number | null,
  target: number
): 'good' | 'warn' | 'bad' | 'neutral' {
  if (marginPct == null) return 'neutral';
  if (marginPct >= target) return 'good';
  if (marginPct >= target - 10) return 'warn';
  return 'bad';
}
