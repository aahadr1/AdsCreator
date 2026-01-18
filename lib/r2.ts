import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl?: string | null;
  region?: string | null;
  endpoint?: string | null;
};

export function createR2Client({ accountId, accessKeyId, secretAccessKey, region, endpoint }: R2Config): S3Client {
  const ep = (endpoint && endpoint.trim()) || `https://${accountId}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: region || 'auto',
    endpoint: ep,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function ensureR2Bucket(client: S3Client, bucket: string): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch {
      // Best-effort: if creation fails due to permissions or already exists, continue
    }
  }
}

export async function r2PutObject({
  client,
  bucket,
  key,
  body,
  contentType,
  cacheControl,
}: {
  client: S3Client;
  bucket: string;
  key: string;
  body: Uint8Array | Buffer | string;
  contentType?: string | null;
  cacheControl?: string | null;
}): Promise<void> {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType || undefined,
    CacheControl: cacheControl || undefined,
  }));
}

async function readableToUint8Array(stream: Readable): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new Uint8Array(Buffer.concat(chunks));
}

export async function r2GetObject({
  client,
  bucket,
  key,
}: {
  client: S3Client;
  bucket: string;
  key: string;
}): Promise<{ body: Uint8Array; contentType: string | null; cacheControl: string | null }> {
  const out: any = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bodyStream = out?.Body as Readable | undefined;
  if (!bodyStream) throw new Error('R2 getObject returned no body');
  const body = await readableToUint8Array(bodyStream);
  const contentType = typeof out?.ContentType === 'string' ? out.ContentType : null;
  const cacheControl = typeof out?.CacheControl === 'string' ? out.CacheControl : null;
  return { body, contentType, cacheControl };
}

export function r2PublicUrl({ publicBaseUrl, bucket, key }: { publicBaseUrl?: string | null; bucket: string; key: string }): string | null {
  if (publicBaseUrl) {
    const base = publicBaseUrl.replace(/\/$/, '');
    return `${base}/${key}`;
  }
  // If no public base URL configured, return null (use signed URLs via Cloudflare if desired later)
  return null;
}


