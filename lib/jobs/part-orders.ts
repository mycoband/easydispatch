export const PART_ORDER_STATUSES = [
  'needed',
  'ordered',
  'received',
  'installed',
  'cancelled',
] as const;

export type PartOrderStatus = (typeof PART_ORDER_STATUSES)[number];

const NEXT_STATUS: Partial<Record<PartOrderStatus, PartOrderStatus>> = {
  needed: 'ordered',
  ordered: 'received',
  received: 'installed',
};

export function nextPartOrderStatus(status: string): PartOrderStatus | null {
  return NEXT_STATUS[status as PartOrderStatus] ?? null;
}
