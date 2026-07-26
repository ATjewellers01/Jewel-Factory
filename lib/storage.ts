/**
 * S3 signed direct uploads. The browser uploads to a short-lived presigned PUT
 * URL while the bucket remains private; public reads are served through the
 * configured CloudFront/S3 public base URL.
 */
import crypto from 'node:crypto';

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { getServerEnv } from '@/lib/env';

export type Bucket = 'catalog' | 'tryon' | 'logo' | 'custom';

const FORMATS: Record<Bucket, string[]> = {
  catalog: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
  tryon: ['png', 'webp', 'avif'],
  logo: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
  custom: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
};

const MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_TTL_SECONDS = 5 * 60;

let client: S3Client | null = null;

function s3(): S3Client {
  if (client) return client;
  client = new S3Client({ region: getServerEnv().AWS_REGION });
  return client;
}

function storageConfig(): { bucket: string; publicBaseUrl: string } {
  const env = getServerEnv();
  if (!env.AWS_S3_BUCKET) throw new Error('AWS_S3_BUCKET is not configured.');
  const fallback = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`;
  return {
    bucket: env.AWS_S3_BUCKET,
    publicBaseUrl: (env.S3_PUBLIC_BASE_URL || fallback).replace(/\/$/, ''),
  };
}

export function manufacturerFolder(manufacturerId: string, bucket: 'catalog' | 'tryon'): string {
  return `jewelfactory/manufacturer/${manufacturerId}/${bucket}`;
}

export function storeFolder(storeId: string, bucket: 'logo' | 'custom'): string {
  return `jewelfactory/store/${storeId}/${bucket}`;
}

/**
 * Logo folder for a retailer that does not exist yet (self-registration happens
 * before any Store row, so there is no storeId to scope by). Keys land under a
 * dedicated prefix so these uploads are distinguishable from tenant-scoped ones.
 */
export function registrationLogoFolder(): string {
  return 'jewelfactory/registration/logo';
}

export type SignedUpload = {
  uploadUrl: string;
  publicId: string;
  secureUrl: string;
  allowedFormats: string[];
  maxBytes: number;
};

export async function signUpload(opts: { folder: string; bucket: Bucket }): Promise<SignedUpload> {
  const { bucket, publicBaseUrl } = storageConfig();
  const key = `${opts.folder}/${crypto.randomUUID()}`;
  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: UPLOAD_TTL_SECONDS },
  );

  return {
    uploadUrl,
    publicId: key,
    secureUrl: `${publicBaseUrl}/${key}`,
    allowedFormats: FORMATS[opts.bucket],
    maxBytes: MAX_BYTES,
  };
}

export function publicIdBelongsToManufacturer(publicId: string, manufacturerId: string): boolean {
  return publicId.startsWith(`jewelfactory/manufacturer/${manufacturerId}/`);
}

export async function deleteAsset(publicId: string): Promise<boolean> {
  const { bucket } = storageConfig();
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: publicId }));
    return true;
  } catch {
    return false;
  }
}
