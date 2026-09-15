import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { InstagramAccount } from "@prisma/client";

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";

type CredentialFields = Pick<InstagramAccount, "appSecret" | "verifyToken" | "pageAccessToken">;

function encryptionKey(): Buffer {
  const encoded = process.env.META_CREDENTIALS_ENCRYPTION_KEY;
  if (!encoded) throw new Error("META_CREDENTIALS_ENCRYPTION_KEY não configurada");

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("META_CREDENTIALS_ENCRYPTION_KEY precisa ser uma chave Base64 de 32 bytes");
  }
  return key;
}

export function assertCredentialsEncryptionKey(): void {
  encryptionKey();
}

export function encryptCredential(value: string): string {
  if (!value || value.startsWith(PREFIX)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptCredential(value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value;

  const [prefix, version, ivBase64, tagBase64, ciphertextBase64] = value.split(":");
  if (prefix !== "enc" || version !== "v1" || !ivBase64 || !tagBase64 || !ciphertextBase64) {
    throw new Error("Credencial Meta cifrada em formato inválido");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivBase64, "base64"));
    decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextBase64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Não foi possível decifrar uma credencial Meta; confira META_CREDENTIALS_ENCRYPTION_KEY");
  }
}

export function encryptCredentials<T extends Partial<CredentialFields>>(credentials: T): T {
  return {
    ...credentials,
    ...(credentials.appSecret === undefined ? {} : { appSecret: encryptCredential(credentials.appSecret) }),
    ...(credentials.verifyToken === undefined ? {} : { verifyToken: encryptCredential(credentials.verifyToken) }),
    ...(credentials.pageAccessToken === undefined ? {} : { pageAccessToken: encryptCredential(credentials.pageAccessToken) }),
  };
}

export function decryptInstagramAccount(account: InstagramAccount): InstagramAccount {
  return {
    ...account,
    appSecret: decryptCredential(account.appSecret),
    verifyToken: decryptCredential(account.verifyToken),
    pageAccessToken: decryptCredential(account.pageAccessToken),
  };
}
