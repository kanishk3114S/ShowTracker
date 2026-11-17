import { supabase } from './supabase';

export const AVATAR_BUCKET = 'avatars';
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const OUTPUT_SIZE = 512;

/** Returns an error message for an unusable file, or null when the file is acceptable. */
export function validateAvatarFile(file) {
  if (!file) return 'Choose an image first.';
  if (!AVATAR_TYPES.includes(file.type)) return 'Use a JPEG, PNG or WebP image.';
  if (file.size > AVATAR_MAX_BYTES) return 'That image is larger than 5 MB.';
  return null;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Centre-crops to a square and downsizes to 512x512 (WebP, or JPEG where WebP
 * encoding is unsupported). Keeps uploads small and avatars consistent.
 * Resolves to the original file if the browser cannot decode or re-encode it.
 */
export async function compressAvatar(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    const target = Math.min(OUTPUT_SIZE, side);
    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;
    canvas.getContext('2d').drawImage(bitmap, sx, sy, side, side, 0, 0, target, target);
    let blob = await canvasToBlob(canvas, 'image/webp', 0.88);
    if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  } finally {
    bitmap.close?.();
  }
}

const EXT_BY_TYPE = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** Path inside the bucket of one of our own avatar URLs, or null for any external URL. */
function ownedStoragePath(url, userId) {
  if (!url || !userId) return null;
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const path = decodeURIComponent(url.slice(at + marker.length).split('?')[0]);
  return path.startsWith(`${userId}/`) ? path : null;
}

/** Best-effort cleanup of the avatar being replaced. Never throws: a leftover file is harmless. */
export async function removeOldAvatar(previousUrl, userId) {
  const path = ownedStoragePath(previousUrl, userId);
  if (!path) return;
  try {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  } catch {
    /* ignore */
  }
}

/**
 * Compresses and uploads `file` to `avatars/<userId>/<timestamp>.<ext>`.
 * Resolves to the public URL; throws an Error with a user-readable message otherwise.
 */
export async function uploadAvatar(file, userId) {
  const problem = validateAvatarFile(file);
  if (problem) throw new Error(problem);
  if (!userId) throw new Error('You need to be signed in to upload a picture.');

  const body = await compressAvatar(file);
  const contentType = body.type || file.type;
  const ext = EXT_BY_TYPE[contentType] || 'jpg';
  const filePath = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(filePath, body, { upsert: true, contentType });
  if (error) {
    throw new Error(
      /bucket not found/i.test(error.message)
        ? 'Picture storage is not set up yet. Paste an image link instead.'
        : `Upload failed: ${error.message}`
    );
  }
  const {
    data: { publicUrl }
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
  return publicUrl;
}
