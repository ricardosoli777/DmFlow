import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptCredential, encryptCredential, encryptCredentials } from "../credentials";

const encryptionKey = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
let previousKey: string | undefined;

beforeEach(() => {
  previousKey = process.env.META_CREDENTIALS_ENCRYPTION_KEY;
  process.env.META_CREDENTIALS_ENCRYPTION_KEY = encryptionKey;
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.META_CREDENTIALS_ENCRYPTION_KEY;
  else process.env.META_CREDENTIALS_ENCRYPTION_KEY = previousKey;
});

describe("Meta credential encryption", () => {
  it("encrypts and decrypts a credential without preserving its plaintext", () => {
    const plaintext = "instagram-access-token";
    const encrypted = encryptCredential(plaintext);

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptCredential(encrypted)).toBe(plaintext);
  });

  it("encrypts only the sensitive account fields", () => {
    const encrypted = encryptCredentials({
      appSecret: "app-secret",
      verifyToken: "verify-token",
      pageAccessToken: "page-token",
    });

    expect(encrypted.appSecret).toMatch(/^enc:v1:/);
    expect(encrypted.verifyToken).toMatch(/^enc:v1:/);
    expect(encrypted.pageAccessToken).toMatch(/^enc:v1:/);
  });
});

