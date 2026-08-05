'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/admin';
import { normalizePhone } from '@/lib/twilio';

export type ActionState = {
  error?: string;
  success?: string;
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function emptyToNull(value?: string | null) {
  const v = value?.trim();
  return v ? v : null;
}

export async function saveCompanySettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase, profile } = await requireOffice();

    const name = formString(formData, 'name').trim();
    if (!name) return { error: 'Company name is required' };

    let logoUrl: string | null = emptyToNull(
      formString(formData, 'existing_logo_url')
    );
    const file = formData.get('logo');

    if (file instanceof File && file.size > 0) {
      const admin = createServiceClient();
      const ext =
        file.type === 'image/png'
          ? 'png'
          : file.type === 'image/webp'
            ? 'webp'
            : file.type === 'image/svg+xml'
              ? 'svg'
              : 'jpg';
      const fileName = `logo/${Date.now()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await admin.storage
        .from('company-assets')
        .upload(fileName, buffer, {
          contentType: file.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        return {
          error: `Logo upload failed: ${uploadError.message}. Confirm the company-assets bucket exists.`,
        };
      }

      const { data: urlData } = admin.storage
        .from('company-assets')
        .getPublicUrl(fileName);
      logoUrl = urlData.publicUrl;
    }

    const payload: Record<string, unknown> = {
      name,
      legal_name: emptyToNull(formString(formData, 'legal_name')),
      phone: emptyToNull(formString(formData, 'phone')),
      email: emptyToNull(formString(formData, 'email')),
      website: emptyToNull(formString(formData, 'website')),
      address: emptyToNull(formString(formData, 'address')),
      city: emptyToNull(formString(formData, 'city')),
      state: emptyToNull(formString(formData, 'state')) || 'MO',
      zip: emptyToNull(formString(formData, 'zip')),
      license_number: emptyToNull(formString(formData, 'license_number')),
      logo_url: logoUrl,
      brand_color: emptyToNull(formString(formData, 'brand_color')) || '#1a7af5',
      invoice_footer: emptyToNull(formString(formData, 'invoice_footer')),
      estimate_footer: emptyToNull(formString(formData, 'estimate_footer')),
      sms_signature: emptyToNull(formString(formData, 'sms_signature')),
      google_review_url: emptyToNull(formString(formData, 'google_review_url')),
      receptionist: {
        greeting: emptyToNull(formString(formData, 'receptionist_greeting')),
        service_area: emptyToNull(
          formString(formData, 'receptionist_service_area')
        ),
        business_hours_note: emptyToNull(
          formString(formData, 'receptionist_hours')
        ),
        escalate_phone: emptyToNull(
          formString(formData, 'receptionist_escalate_phone')
        ),
        twilio_phone: (() => {
          const raw = emptyToNull(
            formString(formData, 'receptionist_twilio_phone')
          );
          if (!raw) return null;
          return normalizePhone(raw) || raw;
        })(),
      },
      updated_at: new Date().toISOString(),
    };

    async function writeSettings(body: Record<string, unknown>) {
      if (profile.company_id) {
        const existing = await supabase
          .from('company_settings')
          .select('id')
          .eq('company_id', profile.company_id)
          .maybeSingle();
        if (existing.data?.id) {
          return supabase
            .from('company_settings')
            .update(body)
            .eq('id', existing.data.id);
        }
        return supabase.from('company_settings').upsert(
          { id: 1, company_id: profile.company_id, ...body },
          { onConflict: 'id' }
        );
      }
      return supabase
        .from('company_settings')
        .upsert({ id: 1, ...body }, { onConflict: 'id' });
    }

    let { error } = await writeSettings(payload);
    if (error && /receptionist|column|schema cache/i.test(error.message)) {
      const { receptionist: _dropR, ...withoutReceptionist } = payload;
      ({ error } = await writeSettings(withoutReceptionist));
      if (!error) {
        revalidatePath('/dashboard/settings');
        revalidatePath('/dashboard');
        return {
          success:
            'Saved. AI receptionist fields need the database update — contact support or run the receptionist SQL.',
        };
      }
    }
    if (
      error &&
      /google_review_url|column|schema cache/i.test(error.message)
    ) {
      const { google_review_url: _drop, ...withoutReview } = payload;
      ({ error } = await writeSettings(withoutReview));
      if (!error) {
        revalidatePath('/dashboard/settings');
        revalidatePath('/dashboard');
        return {
          success:
            'Saved. Google review URL could not be stored — check Settings or contact support.',
        };
      }
    }

    if (error) {
      return {
        error: /google_review_url|column|schema cache/i.test(error.message)
          ? 'Could not save Google review URL. Check Settings, then try again, or contact support.'
          : error.message,
      };
    }

    // Keep companies.name in sync for billing UI
    if (profile.company_id) {
      await supabase
        .from('companies')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', profile.company_id);
    }

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard');
    return { success: 'Company settings saved' };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not save settings',
    };
  }
}
