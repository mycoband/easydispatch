/** Cookie: office/owner/dispatcher opted into the technician app UI. */
export const TECH_VIEW_COOKIE = 'ed_tech_view';

export function isTechViewCookie(value: string | undefined | null) {
  return value === '1' || value === 'true';
}
