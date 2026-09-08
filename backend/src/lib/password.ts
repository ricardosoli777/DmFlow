import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, derivedHex] = stored.split(":");
  const derived = scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(derivedHex, "hex");
  return derived.length === storedBuf.length && timingSafeEqual(derived, storedBuf);
}
