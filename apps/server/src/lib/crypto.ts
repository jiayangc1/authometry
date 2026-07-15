import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "../env.js";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomId(prefix: string, bytes = 12): string {
  return `${prefix}_${randomBytes(bytes).toString("base64url")}`;
}

export function hashToken(value: string): string {
  return createHmac("sha256", env.TOKEN_HMAC_KEY).update(value).digest("base64url");
}

export function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function encryptionKey(): Buffer {
  return createHash("sha256").update(env.INSTALLATION_ENCRYPTION_KEY).digest();
}

export function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decrypt(value: string): string {
  const [ivValue, tagValue, ciphertextValue] = value.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error("Encrypted value is malformed.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
