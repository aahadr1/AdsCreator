import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';

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

export function r2PublicUrl({ publicBaseUrl, bucket, key }: { publicBaseUrl?: string | null; bucket: string; key: string }): string | null {
  if (publicBaseUrl) {
    const base = publicBaseUrl.replace(/\/$/, '');
    return `${base}/${key}`;
  }
  // If no public base URL configured, return null (use signed URLs via Cloudflare if desired later)
  return null;
}


