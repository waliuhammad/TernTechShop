/**
 * Product image uploads via Cloudinary's unsigned upload API.
 *
 * Why unsigned: a static site has no server to sign requests with a secret.
 * An unsigned "upload preset" lets the browser upload directly, and the preset
 * itself — configured in the Cloudinary console, see docs/CLOUDINARY-SETUP.md —
 * decides the folder, allowed formats and maximum dimensions.
 *
 * The trade-off to be aware of: the cloud name and preset name are compiled
 * into the site's JavaScript, so anyone who digs them out could upload images
 * to the account. They cannot read, overwrite or delete existing images, and
 * the preset's restrictions cap what they can send. If it is ever abused,
 * delete the preset and create a new one with a different name.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

export const isCloudinaryConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

/** Returns a human-readable problem, or null if the file is acceptable. */
export function validateImageFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `${file.name}: only JPG, PNG, WebP or AVIF images.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name}: ${(file.size / 1024 / 1024).toFixed(1)} MB is over the 5 MB limit.`;
  }
  return null;
}

/**
 * Delivery URL with automatic format/quality and a sensible size ceiling, so a
 * 6000px phone photo is served to shoppers at a reasonable weight.
 */
function optimisedUrl(secureUrl: string): string {
  return secureUrl.replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_1600/');
}

export async function uploadProductImage(file: File): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Image uploads are not configured. Add the Cloudinary keys to .env.');
  }

  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);

  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', UPLOAD_PRESET);

  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUD_NAME)}/image/upload`, {
      method: 'POST',
      body,
    });
  } catch {
    throw new Error(`${file.name}: upload failed — check your connection.`);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    secure_url?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload.secure_url) {
    const reason = payload.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`${file.name}: ${reason}`);
  }

  return optimisedUrl(payload.secure_url);
}
