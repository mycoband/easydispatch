import { normalizePmChecklist } from '@/lib/equipment/pm-checklist';

export type JobPhotoAttachment = {
  id: string;
  kind: string;
  tag: string | null;
  url: string | null;
  caption: string | null;
  created_at: string;
};

type EquipLike = {
  id?: string;
  name?: string | null;
  equipment_type?: string | null;
  pm_checklist?: unknown;
};

/**
 * Flatten PM checklist photos taken on this job into job_attachment-shaped
 * rows so Job photos shows them (and recovers older uploads missing company_id).
 * Only includes photos whose storage path contains this jobId.
 */
export function pmChecklistPhotosAsAttachments(
  jobId: string,
  equipmentList: EquipLike[] | null | undefined,
  existing: JobPhotoAttachment[] = []
): JobPhotoAttachment[] {
  const seen = new Set(
    existing.map((a) => a.url).filter((u): u is string => Boolean(u))
  );
  const extras: JobPhotoAttachment[] = [];
  const jobNeedle = `/${jobId}/`;

  for (const equipment of equipmentList || []) {
    if (!equipment) continue;
    const doc = normalizePmChecklist(equipment.pm_checklist);
    const unit = equipment.name || equipment.equipment_type || 'Unit';

    for (const item of doc.items) {
      const photos = doc.checks[item.id]?.photos || [];
      for (const photo of photos) {
        if (!photo.url || seen.has(photo.url)) continue;
        // Only surface photos uploaded in the context of this job
        if (!photo.url.includes(jobNeedle)) continue;
        seen.add(photo.url);
        extras.push({
          id:
            photo.attachmentId ||
            `pm-${equipment.id || 'eq'}-${item.id}-${photo.url.slice(-20)}`,
          kind: 'photo',
          tag: 'pm',
          url: photo.url,
          caption: `PM: ${item.label} · ${unit}`,
          created_at: photo.at || new Date(0).toISOString(),
        });
      }
    }
  }

  return [...extras, ...existing].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
