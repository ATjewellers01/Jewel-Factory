/**
 * Cloudinary signed direct-upload. Server signs {folder, timestamp, public_id?}
 * so the browser can upload directly without the bytes touching our server, and
 * cannot upload outside the signed folder. NODE-ONLY (uses node:crypto).
 *
 * Folder layout:
 *   jewelfactory/manufacturer/<manufacturerId>/catalog/   product photos
 *   jewelfactory/manufacturer/<manufacturerId>/tryon/     transparent PNGs
 *   jewelfactory/store/<storeId>/logo/                     store branding
 */
import crypto from 'node:crypto';

import { getServerEnv } from '@/lib/env';

export type Bucket = 'catalog' | 'tryon' | 'logo' | 'custom';

const FORMATS: Record<Bucket, string[]> = {
  catalog: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
  tryon: ['png', 'webp', 'avif'], // needs transparency — no jpg
  logo: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
  custom: ['jpg', 'jpeg', 'png', 'webp', 'avif'], // customer reference photos
};

const MAX_BYTES = 10 * 1024 * 1024;

export function manufacturerFolder(manufacturerId: string, bucket: 'catalog' | 'tryon'): string {
  return `jewelfactory/manufacturer/${manufacturerId}/${bucket}`;
}

export function storeFolder(storeId: string, bucket: 'logo' | 'custom'): string {
  return `jewelfactory/store/${storeId}/${bucket}`;
}

export type SignedUpload = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  publicId?: string;
  signature: string;
  uploadUrl: string;
  allowedFormats: string[];
  maxBytes: number;
};

export function signUpload(opts: { folder: string; bucket: Bucket; publicId?: string }): SignedUpload {
  const env = getServerEnv();
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary is not configured (CLOUDINARY_* env missing).');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number> = { folder: opts.folder, timestamp };
  if (opts.publicId) params.public_id = opts.publicId;

  // Cloudinary signature: sort params, join "k=v&...", append secret, SHA-1.
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const signature = crypto
    .createHash('sha1')
    .update(toSign + env.CLOUDINARY_API_SECRET)
    .digest('hex');

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    folder: opts.folder,
    publicId: opts.publicId,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    allowedFormats: FORMATS[opts.bucket],
    maxBytes: MAX_BYTES,
  };
}

/** Prefix ownership check before deleting an asset. */
export function publicIdBelongsToManufacturer(publicId: string, manufacturerId: string): boolean {
  return publicId.startsWith(`jewelfactory/manufacturer/${manufacturerId}/`);
}

/** Delete an asset from Cloudinary. Returns true on success/not-found. */
export async function deleteAsset(publicId: string): Promise<boolean> {
  const env = getServerEnv();
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) return false;
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(toSign + env.CLOUDINARY_API_SECRET).digest('hex');
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: env.CLOUDINARY_API_KEY,
    signature,
  });
  const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`, {
    method: 'POST',
    body,
  });
  const json = (await res.json().catch(() => ({}))) as { result?: string };
  return json.result === 'ok' || json.result === 'not found';
}
