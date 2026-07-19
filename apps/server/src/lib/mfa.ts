import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(value: Buffer): string {
  let bits = "";
  for (const byte of value) bits += byte.toString(2).padStart(8, "0");
  let encoded = "";
  for (let offset = 0; offset < bits.length; offset += 5) {
    const chunk = bits.slice(offset, offset + 5).padEnd(5, "0");
    encoded += alphabet[Number.parseInt(chunk, 2)];
  }
  return encoded;
}

function base32Decode(value: string): Buffer {
  const normalized = value.toUpperCase().replaceAll(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("The TOTP secret is malformed.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret: string, timestamp = Date.now()): string {
  const counter = Math.floor(timestamp / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, timestamp = Date.now()): boolean {
  const normalized = code.replaceAll(/\s|-/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  return [-1, 0, 1].some((window) => {
    const expected = Buffer.from(totpCode(secret, timestamp + window * 30_000));
    const received = Buffer.from(normalized);
    return expected.length === received.length && timingSafeEqual(expected, received);
  });
}

export function totpSetupUri(secret: string, email: string, issuer: string): string {
  const label = `${issuer}:${email}`;
  const target = new URL(`otpauth://totp/${encodeURIComponent(label)}`);
  target.searchParams.set("secret", secret);
  target.searchParams.set("issuer", issuer);
  target.searchParams.set("algorithm", "SHA1");
  target.searchParams.set("digits", "6");
  target.searchParams.set("period", "30");
  return target.toString();
}

export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const value = randomBytes(5).toString("hex");
    return `${value.slice(0, 5)}-${value.slice(5)}`;
  });
}
