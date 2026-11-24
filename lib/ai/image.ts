/** A tweet preview, downscaled once in the service worker and shared by all providers. */
export interface Preview {
  blob: Blob;
  /** Raw base64 of the JPEG, without a data: prefix. */
  base64: string;
  width: number;
  height: number;
}

const TARGET_LONG_SIDE = 768;
/** JEV rejects images whose sides fall outside 280–1568 px. */
const MIN_SIDE = 280;
const MAX_SIDE = 1568;

export function previewSize(width: number, height: number): { width: number; height: number } | null {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  const scale = Math.max(TARGET_LONG_SIDE / long, MIN_SIDE / short);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  if (Math.max(w, h) > MAX_SIDE) return null; // too elongated to fit both limits
  return { width: w, height: h };
}

export async function loadPreview(url: string): Promise<Preview | null> {
  const parsed = new URL(url);
  if (parsed.hostname !== 'pbs.twimg.com') return null;

  const response = await fetch(parsed, { credentials: 'omit' });
  if (!response.ok) return null;
  const bitmap = await createImageBitmap(await response.blob());
  const size = previewSize(bitmap.width, bitmap.height);
  if (!size) return null;

  const canvas = new OffscreenCanvas(size.width, size.height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  return { blob, base64: await toBase64(blob), ...size };
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
