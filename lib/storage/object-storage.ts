import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

type ObjectStoragePutInput = {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
};

export interface ObjectStorageDriver {
  put(input: ObjectStoragePutInput): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const S3_SERVICE = "s3";

function env(name: string): string | undefined {
  return process.env[name];
}

function isS3Configured(): boolean {
  return Boolean(
    env("S3_ENDPOINT") &&
      env("S3_ACCESS_KEY_ID") &&
      env("S3_SECRET_ACCESS_KEY") &&
      env("S3_BUCKET")
  );
}

/**
 * Development-only driver that stores objects on the local filesystem.
 * Never selected in production; object storage (R2/S3) is required there.
 */
class FileSystemObjectStorage implements ObjectStorageDriver {
  private readonly root = path.join(process.cwd(), ".storage");

  private resolve(key: string): string {
    const normalized = key.replace(/^\/+/, "");
    const target = path.join(this.root, normalized);
    if (path.dirname(target) !== path.dirname(path.join(this.root, normalized))) {
      throw new Error("Invalid storage key");
    }
    return target;
  }

  async put(input: ObjectStoragePutInput): Promise<void> {
    const target = this.resolve(input.key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.body);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key)).catch(() => undefined);
  }
}

function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function signatureKey(key: string, dateStamp: string, region: string): Buffer {
  const kDate = hmac(`AWS4${key}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, S3_SERVICE);
  return hmac(kService, "aws4_request");
}

function encodeS3Path(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function amzDate(): { long: string; short: string } {
  const now = new Date();
  const long = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { long, short: long.slice(0, 8) };
}

/**
 * S3-compatible driver (Cloudflare R2 / AWS S3) using AWS Signature V4.
 * Enabled only when S3_* environment variables are configured.
 */
class S3ObjectStorage implements ObjectStorageDriver {
  private readonly endpoint: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    const endpoint = env("S3_ENDPOINT");
    const accessKeyId = env("S3_ACCESS_KEY_ID");
    const secretAccessKey = env("S3_SECRET_ACCESS_KEY");
    const bucket = env("S3_BUCKET");

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error("S3 object storage is not configured");
    }

    this.endpoint = endpoint.replace(/\/+$/, "");
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.bucket = bucket;
    this.region = env("S3_REGION") ?? "auto";
  }

  private url(key: string): string {
    return `${this.endpoint}/${this.bucket}/${encodeS3Path(key)}`;
  }

  private headers(
    method: string,
    url: string,
    payloadHash: string
  ): Headers {
    const { long, short } = amzDate();
    const parsed = new URL(url);
    const canonicalHeaders = {
      host: parsed.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": long,
    };
    const signedHeaders = Object.keys(canonicalHeaders)
      .sort()
      .join(";");

    const canonicalRequest = [
      method,
      parsed.pathname,
      parsed.search,
      Object.entries(canonicalHeaders)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([name, value]) => `${name}:${value}\n`)
        .join(""),
      signedHeaders,
      payloadHash,
    ].join("\n");

    const scope = `${short}/${this.region}/${S3_SERVICE}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      long,
      scope,
      sha256Hex(canonicalRequest),
    ].join("\n");

    const signature = hmac(
      signatureKey(this.secretAccessKey, short, this.region),
      stringToSign
    ).toString("hex");

    const headers = new Headers();
    headers.set("Content-Type", "application/octet-stream");
    headers.set("x-amz-content-sha256", payloadHash);
    headers.set("x-amz-date", long);
    headers.set(
      "Authorization",
      `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    );
    return headers;
  }

  async put(input: ObjectStoragePutInput): Promise<void> {
    const body = Buffer.from(input.body);
    const response = await fetch(this.url(input.key), {
      method: "PUT",
      headers: this.headers("PUT", this.url(input.key), sha256Hex(body)),
      body,
    });

    if (!response.ok) {
      throw new Error(`Object storage put failed with status ${response.status}`);
    }
  }

  async get(key: string): Promise<Buffer> {
    const url = this.url(key);
    const response = await fetch(url, {
      method: "GET",
      headers: this.headers("GET", url, sha256Hex("")),
    });

    if (!response.ok) {
      throw new Error(`Object storage get failed with status ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const url = this.url(key);
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.headers("DELETE", url, sha256Hex("")),
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Object storage delete failed with status ${response.status}`);
    }
  }
}

function createDriver(): ObjectStorageDriver {
  if (isS3Configured()) {
    return new S3ObjectStorage();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Object storage is not configured for production");
  }

  return new FileSystemObjectStorage();
}

let cachedDriver: ObjectStorageDriver | null = null;

function getDriver(): ObjectStorageDriver {
  if (cachedDriver) {
    return cachedDriver;
  }
  cachedDriver = createDriver();
  return cachedDriver;
}

export const objectStorage = {
  put(input: ObjectStoragePutInput): Promise<void> {
    return getDriver().put(input);
  },
  get(key: string): Promise<Buffer> {
    return getDriver().get(key);
  },
  delete(key: string): Promise<void> {
    return getDriver().delete(key);
  },
};
