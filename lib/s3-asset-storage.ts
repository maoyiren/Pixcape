import 'server-only'
import { createHash, createHmac } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { decryptSecretSetting } from '@/lib/secret-settings'

type S3Config = {
  endpoint: string
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}

export type S3AssetStorage = {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
}

const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex')
const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest()

function objectUrl(config: S3Config, key: string) {
  if (!/^assets\/[a-f0-9-]+\.png$/i.test(key)) throw new Error('Invalid asset storage key')
  const endpoint = new URL(config.endpoint)
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('S3 endpoint must be a clean HTTPS URL')
  }
  const basePath = endpoint.pathname.replace(/\/$/, '')
  const objectPath = key.replace(/^s3\\//, '').split('/').map(encodeURIComponent).join('/')
  endpoint.pathname = `${basePath}/${encodeURIComponent(config.bucket)}/${objectPath}`
  return endpoint
}

function authorization(config: S3Config, method: string, url: URL, payload: Buffer) {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = sha256(payload)
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n')
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp)
  const regionKey = hmac(dateKey, config.region)
  const serviceKey = hmac(regionKey, 's3')
  const signingKey = hmac(serviceKey, 'aws4_request')
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')
  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    amzDate,
    payloadHash,
  }
}

async function loadConfig(): Promise<S3Config | null> {
  const keys = ['STORAGE_S3_ENDPOINT', 'STORAGE_S3_BUCKET', 'STORAGE_S3_REGION', 'STORAGE_SECRET_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY']
  const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } })
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]))
  const configured = Boolean(values.STORAGE_S3_ENDPOINT || values.STORAGE_S3_BUCKET || values.STORAGE_SECRET_ACCESS_KEY_ID || values.STORAGE_SECRET_ACCESS_KEY)
  if (!configured) return null
  const accessKeyId = decryptSecretSetting(values.STORAGE_SECRET_ACCESS_KEY_ID)
  const secretAccessKey = decryptSecretSetting(values.STORAGE_SECRET_ACCESS_KEY)
  if (!values.STORAGE_S3_ENDPOINT || !values.STORAGE_S3_BUCKET || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 storage is partially configured; complete endpoint, bucket and credentials before uploading assets.')
  }
  return {
    endpoint: values.STORAGE_S3_ENDPOINT,
    bucket: values.STORAGE_S3_BUCKET,
    region: values.STORAGE_S3_REGION || 'auto',
    accessKeyId,
    secretAccessKey,
  }
}

export async function getS3AssetStorage(): Promise<S3AssetStorage | null> {
  const config = await loadConfig()
  if (!config) return null

  async function request(method: 'PUT' | 'GET' | 'DELETE', key: string, bytes = Buffer.alloc(0), contentType = 'application/octet-stream') {
    const url = objectUrl(config, key)
    const signed = authorization(config, method, url, bytes)
    const response = await fetch(url, {
      method,
      headers: {
        'x-amz-content-sha256': signed.payloadHash,
        'x-amz-date': signed.amzDate,
        authorization: signed.authorization,
        ...(method === 'PUT' ? { 'content-type': contentType } : {}),
      },
      ...(method === 'PUT' ? { body: new Uint8Array(bytes) } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
    if (method === 'DELETE' && response.status === 404) return
    if (!response.ok) throw new Error(`S3 ${method} failed with HTTP ${response.status}`)
    return response
  }

  return {
    async put(key, bytes, contentType) { await request('PUT', key, bytes, contentType) },
    async get(key) {
      const response = await request('GET', key)
      if (!response) throw new Error('S3 object response is missing')
      return Buffer.from(await response.arrayBuffer())
    },
    async delete(key) { await request('DELETE', key) },
  }
}
