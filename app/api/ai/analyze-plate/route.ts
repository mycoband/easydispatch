import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  analyzeDataPlate,
  buildElectricalSummary,
} from '@/lib/grok';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

const bodySchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().optional(),
  customerId: z.string().uuid().optional().nullable(),
});

/**
 * POST /api/ai/analyze-plate
 * Vision-only nameplate extract (fast). Filter lookup is a separate call.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';

    let imageBase64: string;
    let mimeType = 'image/jpeg';
    let customerId: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('image');
      const customerField = formData.get('customerId');

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No image provided' }, { status: 400 });
      }

      if (file.size > 12 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Image must be under 12MB' },
          { status: 400 }
        );
      }

      mimeType = file.type || 'image/jpeg';
      if (!mimeType.startsWith('image/')) {
        return NextResponse.json(
          { error: 'File must be an image' },
          { status: 400 }
        );
      }

      customerId =
        typeof customerField === 'string' && customerField
          ? customerField
          : null;

      const buffer = Buffer.from(await file.arrayBuffer());
      imageBase64 = buffer.toString('base64');
    } else {
      const json = await req.json();
      const parsed = bodySchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Invalid body' },
          { status: 400 }
        );
      }

      imageBase64 = parsed.data.imageBase64.replace(
        /^data:image\/[a-zA-Z+]+;base64,/,
        ''
      );
      mimeType = parsed.data.mimeType || 'image/jpeg';
      customerId = parsed.data.customerId ?? null;
    }

    if (customerId) {
      const customerCheck = z.string().uuid().safeParse(customerId);
      if (!customerCheck.success) {
        return NextResponse.json({ error: 'Invalid customerId' }, { status: 400 });
      }
    }

    const extracted = await analyzeDataPlate(imageBase64, mimeType);
    const electrical = buildElectricalSummary(extracted);

    return NextResponse.json({
      success: true,
      extracted: {
        ...extracted,
        electrical,
      },
      customerId,
    });
  } catch (error: unknown) {
    console.error('analyze-plate error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to analyze data plate';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
