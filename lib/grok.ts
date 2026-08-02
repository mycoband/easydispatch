/**
 * xAI Grok API helpers
 * Docs: https://docs.x.ai
 */

import { z } from 'zod';

const XAI_CHAT_URL = 'https://api.x.ai/v1/chat/completions';
const XAI_RESPONSES_URL = 'https://api.x.ai/v1/responses';

export const plateExtractionSchema = z.object({
  manufacturer: z.string().nullable().optional(),
  model_number: z.string().nullable().optional(),
  serial_number: z.string().nullable().optional(),
  equipment_type: z.string().nullable().optional(),
  capacity: z.string().nullable().optional(),
  voltage: z.string().nullable().optional(),
  phase: z.string().nullable().optional(),
  amperage: z.string().nullable().optional(),
  refrigerant: z.string().nullable().optional(),
  electrical: z.string().nullable().optional(),
  filter_size: z.string().nullable().optional(),
  filter_qty: z.union([z.number(), z.string()]).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type PlateExtraction = z.infer<typeof plateExtractionSchema>;

export const pickTicketLineSchema = z.object({
  description: z.string().trim().min(1).max(400),
  sku: z.string().trim().max(120).nullable().optional(),
  qty: z.coerce.number().min(0).max(9999).default(1),
  unit_cost: z.coerce.number().min(0).max(999999).nullable().optional(),
});

export const pickTicketExtractionSchema = z.object({
  vendor: z.string().trim().max(200).nullable().optional(),
  ticket_number: z.string().trim().max(120).nullable().optional(),
  date: z.string().trim().max(80).nullable().optional(),
  lines: z.array(pickTicketLineSchema).max(80).default([]),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type PickTicketExtraction = z.infer<typeof pickTicketExtractionSchema>;
export type PickTicketLine = z.infer<typeof pickTicketLineSchema>;

const filterLookupSchema = z.object({
  filter_size: z.string().nullable().optional(),
  filter_qty: z.union([z.number(), z.string()]).nullable().optional(),
  source: z.string().nullable().optional(),
  confidence: z.enum(['high', 'medium', 'low', 'none']).nullable().optional(),
});

export type FilterLookup = {
  filter_size: string | null;
  filter_qty: number | null;
  source: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none' | null;
  searched: boolean;
};

function requireApiKey() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'XAI_API_KEY is not set. Add it to .env.local from https://console.x.ai'
    );
  }
  return apiKey;
}

function visionModel() {
  return process.env.XAI_VISION_MODEL || 'grok-4.5';
}

function chatModel() {
  return process.env.XAI_CHAT_MODEL || process.env.XAI_VISION_MODEL || 'grok-4.5';
}

/**
 * Optional native video_url models. Off unless XAI_VIDEO_NATIVE=1 —
 * official Grok chat models are image+text; we use frames + Whisper instead.
 */
function videoModelCandidates(): string[] {
  if (process.env.XAI_VIDEO_NATIVE?.trim() !== '1') return [];
  const preferred = process.env.XAI_VIDEO_MODEL?.trim();
  const list = [preferred, 'grok-4.3', 'grok-4-3'].filter(
    (m): m is string => Boolean(m)
  );
  return [...new Set(list)];
}

export async function callGrok(
  messages: unknown[],
  options: { model?: string; temperature?: number } = {}
) {
  const apiKey = requireApiKey();
  const model = options.model || visionModel();

  const res = await fetch(XAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.1,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Grok API error (${model}): ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/** Responses API with server-side web_search (for filter / model lookups). */
async function callGrokWithWebSearch(prompt: string): Promise<string> {
  const apiKey = requireApiKey();

  const res = await fetch(XAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: chatModel(),
      tools: [{ type: 'web_search' }],
      input: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Grok search API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return extractResponsesText(data);
}

function extractResponsesText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const obj = data as Record<string, unknown>;

  if (typeof obj.output_text === 'string' && obj.output_text.trim()) {
    return obj.output_text;
  }

  const output = obj.output;
  if (!Array.isArray(output)) return '';

  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    if (entry.type === 'message' && Array.isArray(entry.content)) {
      for (const part of entry.content) {
        if (!part || typeof part !== 'object') continue;
        const p = part as Record<string, unknown>;
        if (
          (p.type === 'output_text' || p.type === 'text') &&
          typeof p.text === 'string'
        ) {
          chunks.push(p.text);
        }
      }
    }
  }
  return chunks.join('\n').trim();
}

function parseJsonContent(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      return JSON.parse(fence[1].trim());
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('No JSON object in model response');
  }
}

function normalizeFilterQty(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0 || n > 99) return null;
  return Math.round(n);
}

/**
 * Analyze an equipment data plate image with Grok Vision.
 * Filter size/qty are only filled if literally printed on the plate —
 * otherwise leave null and use lookupFilterSpecs().
 */
export async function analyzeDataPlate(
  imageBase64: string,
  mimeType = 'image/jpeg'
): Promise<PlateExtraction> {
  const systemPrompt = `You are an expert HVAC technician assistant.
Analyze the equipment data plate / nameplate image and extract all available information.
Return ONLY valid JSON with these fields (use null if not found):

{
  "manufacturer": string | null,
  "model_number": string | null,
  "serial_number": string | null,
  "equipment_type": string | null,
  "capacity": string | null,
  "voltage": string | null,
  "phase": string | null,
  "amperage": string | null,
  "refrigerant": string | null,
  "electrical": string | null,
  "filter_size": string | null,
  "filter_qty": number | null,
  "notes": string | null
}

equipment_type should be one of: RTU, Condenser, Furnace, Air Handler, Heat Pump, Boiler, Mini-Split, Walk-in Cooler, Walk-in Freezer, Other — or the closest match.

IMPORTANT for filters:
- Only set filter_size / filter_qty if they are clearly printed on the plate or a filter label visible in the image.
- Do NOT guess filter size from memory. A later web lookup will find filter specs from model/serial.
- Prefer leaving filter_size and filter_qty as null when not on the plate.

Be precise. Do not invent values.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${imageBase64}`,
            detail: 'high',
          },
        },
        {
          type: 'text',
          text: 'Extract all information from this HVAC equipment data plate.',
        },
      ],
    },
  ];

  const raw = await callGrok(messages, {
    model: visionModel(),
    temperature: 0,
  });

  try {
    const parsed = parseJsonContent(raw);
    return plateExtractionSchema.parse(parsed);
  } catch (err) {
    console.error('Failed to parse Grok plate response:', raw, err);
    return {
      manufacturer: null,
      model_number: null,
      serial_number: null,
      equipment_type: null,
      capacity: null,
      voltage: null,
      phase: null,
      amperage: null,
      refrigerant: null,
      electrical: null,
      filter_size: null,
      filter_qty: null,
      notes: typeof raw === 'string' ? raw.slice(0, 2000) : null,
    };
  }
}

/** Extract line items from a parts counter / pick ticket / packing slip photo. */
export async function extractPickTicketFromImage(
  imageBase64: string,
  mimeType = 'image/jpeg'
): Promise<PickTicketExtraction> {
  const systemPrompt = `You are an expert at reading HVAC/R parts counter pick tickets, packing slips, and vendor receipts.

Extract every line item from the image. Return ONLY valid JSON:

{
  "vendor": string | null,
  "ticket_number": string | null,
  "date": string | null,
  "lines": [
    {
      "description": string,
      "sku": string | null,
      "qty": number,
      "unit_cost": number | null
    }
  ],
  "notes": string | null
}

Rules:
- description is required for each line (part name / description as printed).
- sku: part number / item code if visible, else null.
- qty: number of units (default 1 if unclear).
- unit_cost: unit price if clearly printed, else null. Prefer unit price over line total.
- Do not invent parts that are not on the ticket.
- Ignore tax/shipping totals as separate "parts" lines unless they are clearly a billable part.
- If the image is unreadable, return empty lines and a short notes explanation.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${imageBase64}`,
            detail: 'high',
          },
        },
        {
          type: 'text',
          text: 'Extract all parts lines from this pick ticket / packing slip.',
        },
      ],
    },
  ];

  const raw = await callGrok(messages, {
    model: visionModel(),
    temperature: 0,
  });

  try {
    const parsed = pickTicketExtractionSchema.safeParse(parseJsonContent(raw));
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    return {
      ...parsed.data,
      lines: (parsed.data.lines || [])
        .map((line) => ({
          description: line.description.trim(),
          sku: line.sku?.trim() || null,
          qty: line.qty > 0 ? line.qty : 1,
          unit_cost:
            line.unit_cost === null || line.unit_cost === undefined
              ? null
              : Number(line.unit_cost),
        }))
        .filter((line) => line.description.length > 0),
    };
  } catch (err) {
    console.error('Failed to parse pick ticket extract:', raw, err);
    return {
      vendor: null,
      ticket_number: null,
      date: null,
      lines: [],
      notes: 'Could not read pick ticket — try a clearer photo.',
    };
  }
}

function filterLookupPrompt(unit: {
  manufacturer: string | null;
  model: string | null;
  serial: string | null;
  type: string | null;
}, mode: 'fast' | 'web') {
  const modeLine =
    mode === 'web'
      ? 'Use web search. Find OEM install/service manual or parts list for THIS EXACT model number. Prefer manufacturer PDF specs over generic blog posts.'
      : 'Answer only if you know the OEM filter size for THIS EXACT model from manufacturer docs. If you are not sure, return nulls — do not guess.';

  return `You are an HVAC parts specialist. ${modeLine}

Unit details from the data plate:
- Manufacturer: ${unit.manufacturer || 'unknown'}
- Model: ${unit.model || 'unknown'}
- Serial: ${unit.serial || 'unknown'}
- Equipment type: ${unit.type || 'unknown'}

Return ONLY valid JSON (no markdown):
{
  "filter_size": string | null,
  "filter_qty": number | null,
  "source": string | null,
  "confidence": "high" | "medium" | "low" | "none"
}

Critical rules:
- Match the EXACT model number (not a similar series).
- NEVER default to common sizes like 16x25x1 or 16x25x2 unless the OEM doc for this model says so. Many commercial RTUs / package units use 20x20x2, 20x25x2, 25x25x2, etc.
- Thickness (last number) matters: 1 vs 2 inch are different — do not swap them.
- filter_size format: "20x20x2" (inches WxHxD). Dual racks: "20x20x2 + 20x20x2" or report qty accordingly.
- filter_qty = how many filters the unit takes (not retail pack size).
- If sources conflict or model is ambiguous, return nulls with confidence "none" or "low".
- source should name the manual/page/site when possible.`;
}

/**
 * Fast filter lookup (chat, no tools) — similar speed to the Grok app for common models.
 * Optional web mode uses Responses API + web_search (slower, more thorough).
 */
export async function lookupFilterSpecs(
  unit: {
    manufacturer?: string | null;
    model_number?: string | null;
    serial_number?: string | null;
    equipment_type?: string | null;
  },
  options: { mode?: 'fast' | 'web' } = {}
): Promise<FilterLookup> {
  const mode = options.mode || 'fast';
  const manufacturer = unit.manufacturer?.trim() || null;
  const model = unit.model_number?.trim() || null;
  const serial = unit.serial_number?.trim() || null;
  const type = unit.equipment_type?.trim() || null;

  if (!manufacturer && !model) {
    return {
      filter_size: null,
      filter_qty: null,
      source: null,
      confidence: 'none',
      searched: false,
    };
  }

  const prompt = filterLookupPrompt(
    { manufacturer, model, serial, type },
    mode
  );

  try {
    const raw =
      mode === 'web'
        ? await callGrokWithWebSearch(prompt)
        : await callGrok(
            [
              {
                role: 'system',
                content:
                  'Return only JSON. Prefer a best-known OEM filter size for common HVAC models.',
              },
              { role: 'user', content: prompt },
            ],
            { model: chatModel(), temperature: 0 }
          );

    const parsed = filterLookupSchema.parse(parseJsonContent(raw));
    return {
      filter_size: parsed.filter_size?.trim() || null,
      filter_qty: normalizeFilterQty(parsed.filter_qty),
      source: parsed.source?.trim() || (mode === 'fast' ? 'model knowledge' : null),
      confidence: parsed.confidence ?? null,
      searched: true,
    };
  } catch (err) {
    console.error('Filter lookup failed:', err);
    return {
      filter_size: null,
      filter_qty: null,
      source: null,
      confidence: 'none',
      searched: true,
    };
  }
}

/** Fill filter gaps from a lookup result. */
export function mergeFilterLookup(
  extracted: PlateExtraction,
  filterLookup: FilterLookup
): PlateExtraction {
  const merged: PlateExtraction = {
    ...extracted,
    filter_size: extracted.filter_size?.trim() || filterLookup.filter_size,
    filter_qty:
      normalizeFilterQty(extracted.filter_qty) ?? filterLookup.filter_qty,
  };

  if (filterLookup.source && filterLookup.filter_size) {
    const note = `Filter lookup: ${filterLookup.source}${
      filterLookup.confidence ? ` (${filterLookup.confidence})` : ''
    }`;
    merged.notes = extracted.notes ? `${extracted.notes}\n${note}` : note;
  }

  return merged;
}

export function buildElectricalSummary(extracted: PlateExtraction) {
  if (extracted.electrical?.trim()) return extracted.electrical.trim();
  const parts = [extracted.voltage, extracted.phase, extracted.amperage]
    .map((p) => p?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

export const diagnosticAssistSchema = z.object({
  likely_causes: z.array(z.string()).default([]),
  checks: z.array(z.string()).default([]),
  parts_to_bring: z.array(z.string()).default([]),
  safety_notes: z.array(z.string()).default([]),
  summary: z.string().nullable().optional(),
});

export type DiagnosticAssist = z.infer<typeof diagnosticAssistSchema>;

/** Symptom + equipment → likely causes / parts for field techs. */
export async function assistDiagnosis(input: {
  symptoms: string;
  equipmentType?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  jobType?: string | null;
}): Promise<DiagnosticAssist> {
  const symptoms = input.symptoms.trim();
  if (!symptoms) {
    throw new Error('Describe the symptoms first');
  }

  const equip = [
    input.equipmentType,
    input.manufacturer,
    input.model,
  ]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' · ');

  const content = await callGrok(
    [
      {
        role: 'system',
        content: `You are an expert residential/commercial HVAC field diagnostic assistant.
Return ONLY valid JSON:
{
  "likely_causes": string[] (3-6 most likely, most common first),
  "checks": string[] (ordered diagnostic steps the tech should do on site),
  "parts_to_bring": string[] (common parts that often fix this),
  "safety_notes": string[] (brief safety reminders),
  "summary": string (1-2 sentence overview)
}
Be practical and concise. Prefer common field failures over exotic ones.`,
      },
      {
        role: 'user',
        content: `Job type: ${input.jobType || 'service'}
Equipment: ${equip || 'unknown'}
Symptoms / complaint:
${symptoms}`,
      },
    ],
    { model: chatModel(), temperature: 0.2 }
  );

  const parsed = diagnosticAssistSchema.safeParse(parseJsonContent(content));
  if (!parsed.success) {
    throw new Error('Could not parse diagnostic response');
  }
  return parsed.data;
}

export const ticketFillSchema = z.object({
  job_type: z.string().trim().min(1).max(200).default('Service call'),
  priority: z.enum(['Low', 'Medium', 'High', 'Emergency']).default('Medium'),
  status: z.enum(['New', 'Scheduled', 'In Progress']).default('New'),
  diagnosis: z.string().trim().max(10000).default(''),
  customer_summary: z.string().trim().max(10000).nullable().optional(),
  internal_notes: z.string().trim().max(10000).nullable().optional(),
  notes: z.string().trim().max(10000).nullable().optional(),
  est_hours: z.number().min(0).max(999).nullable().optional(),
  is_callback: z.boolean().default(false),
  warranty_flag: z.boolean().default(false),
  /** Local datetime for <input type="datetime-local"> — YYYY-MM-DDTHH:mm */
  scheduled_start_local: z.string().trim().nullable().optional(),
  matched_customer_name: z.string().trim().nullable().optional(),
  suggested_line_items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(500),
        qty: z.number().min(0).max(99999).default(1),
        unit_price: z.number().min(0).max(999999).nullable().optional(),
      })
    )
    .max(12)
    .default([]),
  summary: z.string().trim().max(500).nullable().optional(),
});

export type TicketFill = z.infer<typeof ticketFillSchema>;

/**
 * Turn a dispatcher’s free-text call notes into structured job fields.
 * Pass known customer names so the model can suggest a match.
 */
export async function fillTicketFromText(input: {
  text: string;
  customerNames?: string[];
  nowLocal?: string;
  jobTypeOptions?: string[];
}): Promise<TicketFill> {
  const text = input.text.trim();
  if (text.length < 8) {
    throw new Error('Paste a bit more detail (who called, what’s wrong, when).');
  }

  const jobTypes =
    input.jobTypeOptions?.length
      ? input.jobTypeOptions.join(', ')
      : 'Service call, No cool, No heat, Maintenance / PM, Install, Estimate / quote, Callback, Emergency';

  const customers =
    input.customerNames && input.customerNames.length > 0
      ? input.customerNames.slice(0, 80).join('\n- ')
      : '(no customer list provided)';

  const nowLocal =
    input.nowLocal ||
    new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const content = await callGrok(
    [
      {
        role: 'system',
        content: `You are an HVAC dispatch assistant for shops using EasyDispatch.
Parse the caller's notes into a structured job ticket. Return ONLY valid JSON:
{
  "job_type": string (prefer one of: ${jobTypes}),
  "priority": "Low" | "Medium" | "High" | "Emergency",
  "status": "New" | "Scheduled" | "In Progress",
  "diagnosis": string (clear complaint / symptoms for the tech — rewrite messy notes),
  "customer_summary": string | null (short customer-facing description of the request),
  "internal_notes": string | null (gate codes, pets, access, office tips from the notes),
  "notes": string | null (any leftover general notes),
  "est_hours": number | null,
  "is_callback": boolean,
  "warranty_flag": boolean,
  "scheduled_start_local": string | null (YYYY-MM-DDTHH:mm in America/Chicago if a time is implied; else null),
  "matched_customer_name": string | null (exact name from the provided customer list when clearly the same person/site),
  "suggested_line_items": [{"description": string, "qty": number, "unit_price": number|null}],
  "summary": string | null (1 sentence of what you inferred)
}
Rules:
- Prefer Emergency only for no heat in freezing weather, gas smell, electrical burning smell, flooding, or similar.
- Callback if they mention a recent visit / still broken after service.
- If they ask for a quote/estimate, job_type should be Estimate / quote.
- Do not invent customer names not in the list. matched_customer_name must be null or an exact list entry.
- Keep diagnosis practical for a field tech.`,
      },
      {
        role: 'user',
        content: `Current local time (America/Chicago): ${nowLocal}

Known customers:
- ${customers}

Call / ticket notes:
${text}`,
      },
    ],
    { model: chatModel(), temperature: 0.15 }
  );

  const parsed = ticketFillSchema.safeParse(parseJsonContent(content));
  if (!parsed.success) {
    throw new Error('Could not parse ticket fill response');
  }
  return parsed.data;
}

const voiceNotesSchema = z.object({
  diagnosis: z.string().trim().max(10000).default(''),
  customer_summary: z.string().trim().max(10000).nullable().optional(),
  internal_notes: z.string().trim().max(10000).nullable().optional(),
});

export type VoiceNotesFill = z.infer<typeof voiceNotesSchema>;

/** Turn a field voice transcript into diagnosis + customer-facing summary. */
export async function voiceNotesFromTranscript(input: {
  transcript: string;
  jobType?: string | null;
  existingDiagnosis?: string | null;
}): Promise<VoiceNotesFill> {
  const text = input.transcript.trim();
  if (text.length < 4) {
    throw new Error('Transcript too short');
  }

  const content = await callGrok(
    [
      {
        role: 'system',
        content: `You are an HVAC field assistant. A tech recorded a voice note on a job.
Return ONLY valid JSON:
{
  "diagnosis": string (clear tech-facing symptoms, findings, and work performed / recommended — rewrite messy speech),
  "customer_summary": string | null (short plain-language summary suitable for the customer invoice/portal),
  "internal_notes": string | null (access tips, parts needed, follow-ups — omit if none)
}
Rules:
- Prefer HVAC terminology a tech would use in diagnosis.
- Do not invent equipment model/serial numbers not stated.
- Keep customer_summary friendly and non-technical when possible.
- If prior diagnosis is provided, merge new info rather than discarding it.`,
      },
      {
        role: 'user',
        content: `Job type: ${input.jobType || 'Service'}
Existing diagnosis (may be empty): ${input.existingDiagnosis || '(none)'}

Voice transcript:
${text}`,
      },
    ],
    { model: chatModel(), temperature: 0.2 }
  );

  const parsed = voiceNotesSchema.safeParse(parseJsonContent(content));
  if (!parsed.success) {
    throw new Error('Could not parse voice notes response');
  }
  return parsed.data;
}

export const walkthroughReportSchema = z.object({
  findings: z.string().trim().max(8000).default(''),
  work_performed: z.string().trim().max(8000).default(''),
  parts_used: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(300),
        quantity: z.number().min(0).max(9999).default(1),
        estimated_cost: z.number().min(0).max(999999).default(0),
      })
    )
    .max(40)
    .default([]),
  recommendations: z.string().trim().max(8000).default(''),
  customer_summary: z.string().trim().max(8000).default(''),
  labor_hours_estimated: z.number().min(0).max(999).nullable().optional(),
  labor_rate: z.number().min(0).max(9999).nullable().optional(),
});

export type WalkthroughReport = z.infer<typeof walkthroughReportSchema>;

/**
 * Free-form field notes + voice/video (+ photos / extracted frames) →
 * structured HVAC/R walkthrough report JSON.
 *
 * Video walkthroughs: Grok receives (1) sampled frames to SEE the site and
 * (2) Whisper audio transcripts to HEAR narration. Native video_url is
 * optional via XAI_VIDEO_NATIVE=1.
 */
export async function generateWalkthroughReport(input: {
  notes: string;
  voiceTranscripts?: string[];
  photoUrls?: string[];
  videoUrls?: string[];
  jobType?: string | null;
  equipmentSummary?: string | null;
  customerName?: string | null;
  defaultLaborRate?: number | null;
}): Promise<WalkthroughReport> {
  const notes = input.notes.trim();
  const transcripts = (input.voiceTranscripts || [])
    .map((t) => t.trim())
    .filter(Boolean);
  const photoUrls = (input.photoUrls || []).filter(Boolean).slice(0, 12);
  const videoUrls = (input.videoUrls || []).filter(Boolean).slice(0, 2);
  const hasVideo = videoUrls.length > 0;

  if (
    !notes &&
    transcripts.length === 0 &&
    photoUrls.length === 0 &&
    !hasVideo
  ) {
    throw new Error(
      'Add a video walkthrough, field notes, a voice note, or a photo before generating a report'
    );
  }

  if (hasVideo && photoUrls.length === 0 && videoModelCandidates().length === 0) {
    throw new Error(
      'Video frames missing — re-upload the walkthrough video so frames can be extracted for Grok to see'
    );
  }

  if (hasVideo && transcripts.length === 0) {
    throw new Error(
      'Could not hear the video — set OPENAI_API_KEY for Whisper, then Generate again (speak clearly in the clip)'
    );
  }

  const transcriptBlock =
    transcripts.length > 0
      ? transcripts.map((t, i) => `Audio transcript ${i + 1}:\n${t}`).join('\n\n')
      : '(none)';

  const laborHint =
    input.defaultLaborRate != null && Number.isFinite(input.defaultLaborRate)
      ? `Default shop labor rate if not stated: $${input.defaultLaborRate}/hr.`
      : 'If labor rate is unknown, use a typical US HVAC service rate (~$125–175/hr) and note it is an estimate.';

  const systemPrompt = hasVideo
    ? `You are an expert HVAC / commercial refrigeration field tech and technical writer for EasyDispatch.

You receive a JOB SITE VIDEO WALKTHROUGH as:
1. Still frames sampled across the video (what was SEEN — equipment, nameplates, damage, filters, gauges, wiring, leaks, ice, dirt, access).
2. Full audio transcripts of what was SAID / heard in the video (Whisper).

You MUST document EVERYTHING visible in the frames AND everything said in the transcripts. Be thorough, not sparse. Merge visual evidence with spoken narration into one coherent report.

Return ONLY valid JSON:
{
  "findings": string (detailed: what was SEEN in frames + what the tech SAID),
  "work_performed": string (what was done or clearly described as done; if only inspection, say so),
  "parts_used": [{"name": string, "quantity": number, "estimated_cost": number}],
  "recommendations": string (follow-ups, safety, maintenance from visual + audio evidence),
  "customer_summary": string (plain-language summary for the customer),
  "labor_hours_estimated": number | null,
  "labor_rate": number | null
}

Rules:
- Professional HVAC language in findings/work_performed; friendly plain language in customer_summary.
- Do NOT invent model/serial numbers you cannot read or hear. Quote what is visible or said.
- Do NOT leave findings empty if frames or transcripts contain anything useful.
- Cover the full walkthrough timeline implied by the frames and narration.
- parts_used only for parts mentioned or clearly needed; estimated_cost in USD (rough OK).
- ${laborHint}`
    : `You are an experienced HVAC and commercial refrigeration service technician and technical writer.
Turn field capture into a clean professional walkthrough report for EasyDispatch.

Return ONLY valid JSON:
{
  "findings": string,
  "work_performed": string,
  "parts_used": [{"name": string, "quantity": number, "estimated_cost": number}],
  "recommendations": string,
  "customer_summary": string,
  "labor_hours_estimated": number | null,
  "labor_rate": number | null
}

Rules:
- Be complete and professional. Never invent major work or unread serials.
- parts_used only when clearly needed; estimated_cost in USD (rough OK).
- ${laborHint}`;

  const textBody = hasVideo
    ? `Job type: ${input.jobType || 'Service'}
Customer: ${input.customerName || 'unknown'}
Equipment on file: ${input.equipmentSummary || 'unknown'}

Optional typed notes:
${notes || '(none)'}

FULL audio transcripts from the walkthrough video (HEAR — document all of this):
${transcriptBlock}

Frames from the walkthrough video attached: ${photoUrls.length} (SEE — document all visible equipment/conditions)
Source videos on file: ${videoUrls.length}

TASK: Using the frames and the full transcripts, document everything seen and heard into the JSON report. Do not omit spoken details or obvious visual conditions.`
    : `Job type: ${input.jobType || 'Service'}
Customer: ${input.customerName || 'unknown'}
Equipment: ${input.equipmentSummary || 'unknown'}

Field notes:
${notes || '(none)'}

Voice / audio transcripts:
${transcriptBlock}

Photos attached: ${photoUrls.length}

Produce the structured walkthrough report.`;

  type ContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: string } }
    | { type: 'video_url'; video_url: { url: string } };

  async function runWithParts(model: string, parts: ContentPart[]) {
    const userContent: string | ContentPart[] =
      parts.length === 1 && parts[0].type === 'text' ? textBody : parts;
    const content = await callGrok(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      { model, temperature: 0.15 }
    );
    const parsed = walkthroughReportSchema.safeParse(parseJsonContent(content));
    if (!parsed.success) {
      throw new Error('Could not parse walkthrough report response');
    }
    if (
      hasVideo &&
      !parsed.data.findings?.trim() &&
      !parsed.data.work_performed?.trim() &&
      !parsed.data.customer_summary?.trim()
    ) {
      throw new Error(
        'Grok returned an empty report — walkthrough media may not have been analyzed'
      );
    }
    return parsed.data;
  }

  // Optional native video_url path (off by default — most Grok chat models are image-only)
  if (hasVideo) {
    const nativeModels = videoModelCandidates();
    for (const model of nativeModels) {
      try {
        const parts: ContentPart[] = [];
        for (const url of videoUrls) {
          parts.push({ type: 'video_url', video_url: { url } });
        }
        for (const url of photoUrls.slice(0, 4)) {
          parts.push({
            type: 'image_url',
            image_url: { url, detail: 'low' },
          });
        }
        parts.push({ type: 'text', text: textBody });
        return await runWithParts(model, parts);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('Native video_url walkthrough failed', model, msg);
      }
    }
  }

  // Primary path: vision on frames + text transcripts (see + hear)
  const visionParts: ContentPart[] = [];
  for (const url of photoUrls) {
    visionParts.push({
      type: 'image_url',
      image_url: { url, detail: hasVideo ? 'high' : 'high' },
    });
  }
  visionParts.push({ type: 'text', text: textBody });

  const model =
    photoUrls.length > 0 ? visionModel() : hasVideo ? visionModel() : chatModel();
  return runWithParts(model, visionParts);
}

export type HelpChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/** Office job-scoped assistant grounded in a single job’s data packet. */
export async function jobOfficeAssistant(
  messages: HelpChatMessage[],
  jobContextJson: string
): Promise<string> {
  const recent = messages.slice(-10);
  const content = await callGrok(
    [
      {
        role: 'system',
        content: `You are the EasyDispatch Job assistant for HVAC office staff on ONE open job.

Rules:
- Use ONLY the job data JSON provided. Do not invent line items, payments, times, or customer facts.
- If something is missing from the data, say what is missing and what the office should check in EasyDispatch.
- Common asks: draft customer SMS/email, what’s still missing to invoice/collect payment, summarize for the owner, next office steps.
- When drafting customer text: short, professional, no internal notes or costs unless asked. Offer copy-ready wording.
- Keep answers concise (usually under 200 words). Use short bullets when listing gaps.
- Never ask for passwords, API keys, or card numbers.
- You are not the product Help bot — stay on this job.

Job data (JSON):
${jobContextJson}`,
      },
      ...recent.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ],
    { model: chatModel(), temperature: 0.3 }
  );

  return content.trim();
}

/** In-app help assistant grounded in EasyDispatch FAQ + product facts. */
export async function helpChat(
  messages: HelpChatMessage[],
  faqBlock: string
): Promise<string> {
  const recent = messages.slice(-12);
  const content = await callGrok(
    [
      {
        role: 'system',
        content: `You are the EasyDispatch Help assistant for HVAC field service software (office dashboard + technician app).

Rules:
- Answer only about EasyDispatch product usage, workflows, and troubleshooting.
- Prefer the FAQ facts below; paraphrase clearly in short paragraphs or bullets.
- If something is not covered, say what you know and suggest Settings, the FAQ page, or contacting support — do not invent billing prices, legal terms, or features that are not listed.
- Never ask for passwords, API keys, or payment card numbers.
- Keep answers concise (usually under 180 words).
- Use plain language for HVAC office staff and techs.

Known product facts:
- Office app: /dashboard leads with Needs you (unassigned open jobs, unpaid sent invoices, today’s callbacks) then secondary today’s board/stats; also customers, jobs, calendar, dispatch, estimates, invoices, reports, pricebook, settings.
- Tech app: /tech My jobs shows a Next up hero card (first actionable job + stops left today) with quieter Today/Later/Done below; job tickets use Arrive → Work → Wrap up; today’s run sheet PDF when PDF module on.
- Tech ticket auto-advance: successful Arrive opens Work (?phase=work); successful Clock out opens Wrap up (?phase=wrap). Manual phase tabs still work.
- Work phase capture: when AI Job Walkthrough is on, Record video walkthrough is the hero CTA (“Film + narrate — AI writes the report”); Extra photos stays secondary/collapsed.
- Apply & wrap up: after Generate, primary button saves walkthrough to job (diagnosis/summary/line items) and opens Wrap up (?phase=wrap). Save only stays on Work. Does not auto Clock out — Clock out / Sign are on Wrap.
- Dispatch Assign for me: with Assign-tech AI on, unassigned cards show Assign for me (top ranked tech + reason) → Confirm to assign; manual pick still available.
- Technician view (office): Feature module “Technician view (office)” + Tech view checkbox in office header (or Open technician view on a job) opens the same /tech UI for owners/dispatchers/office (assignee names on My jobs cards); Exit to office on the blue banner.
- Feature modules: Settings → Feature modules lists EVERY optional feature; toggle + Save. Off hides related UI. Core customers + jobs always on.
- Shop presets on Feature modules: Simple (lean), Full field (Simple + field/ops extras), Full shop (everything on). Presets set toggles; Save modules still required to persist.
- New job (~30 seconds): with AI tools on, paste call notes → Fill ticket with AI → review → Create. Primary fields are customer, job type, diagnosis; schedule/assign/job # under More options.
- Job assistant (office): on /dashboard/jobs/[id] when AI tools is on — ask about that job only (draft customer text, what’s missing to invoice, owner summary). Separate from the floating Help bot (FAQ/product).
- Pick tickets: on a job (office or assigned tech) with Special-order parts on — upload counter slip photo → Extract with AI → review lines → Add parts to that job # (Received). SQL: pick-tickets.sql for saved extracts.
- The FAQ block below starts with the full module catalog (labels, groups, how-to) — prefer that list; do not invent modules not listed.
- SQL helpers (run once in Supabase as needed): workflow-depth.sql, differentiation.sql, ops-polish.sql, job-costing.sql, pick-tickets.sql.
- Public FAQ: /faq · In-app Help/FAQ: /dashboard/help or /tech/help (includes Feature modules catalog).
- Floating Help bot: Help button bottom-right; needs AI tools module; chat survives navigation in the browser session.

${faqBlock}`,
      },
      ...recent.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ],
    { model: chatModel(), temperature: 0.25 }
  );

  return content.trim();
}
