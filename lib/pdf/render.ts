import { renderToBuffer } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

/** Render a react-pdf Document to a Uint8Array for NextResponse. */
export async function renderPdf(document: ReactElement) {
  const buffer = await renderToBuffer(document as ReactElement);
  return new Uint8Array(buffer);
}
