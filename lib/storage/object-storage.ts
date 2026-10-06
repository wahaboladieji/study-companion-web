import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
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

/**
 * S3-compatible driver (Cloudflare R2 / AWS S3) using the official AWS SDK.
 * Enabled only when S3_* environment variables are configured.
 */
class S3ObjectStorage implements ObjectStorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const endpoint = env("S3_ENDPOINT");
    const accessKeyId = env("S3_ACCESS_KEY_ID");
    const secretAccessKey = env("S3_SECRET_ACCESS_KEY");
    const bucket = env("S3_BUCKET");

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error("S3 object storage is not configured");
    }

    this.bucket = bucket;
    this.client = new S3Client({
      region: env("S3_REGION") ?? "auto",
      endpoint: endpoint.replace(/\/+$/, ""),
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async put(input: ObjectStoragePutInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      })
    );
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    return Buffer.from(await response.Body!.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
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
