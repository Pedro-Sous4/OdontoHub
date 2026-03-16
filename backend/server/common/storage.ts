import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION ?? 'us-east-1';
const accessKeyId = process.env.S3_ACCESS_KEY;
const secretAccessKey = process.env.S3_SECRET_KEY;
const bucket = process.env.S3_BUCKET ?? 'odonto-files';

export const s3 = new S3Client({
  endpoint,
  region,
  credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  forcePathStyle: true
});

export async function uploadPatientFile(params: {
  tenantId: string;
  patientId: string;
  filename: string;
  contentType: string;
  data: Buffer;
}) {
  const key = `${params.tenantId}/patients/${params.patientId}/${params.filename}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.data,
      ContentType: params.contentType
    })
  );

  return { key, bucket };
}
