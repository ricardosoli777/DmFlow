import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://redis:6379"),
  JWT_SECRET: z.string().min(16),
  // RF14 — base pública do backend, usada pra montar a URL de redirect dos
  // links rastreados (`{PUBLIC_API_URL}/r/{code}`). Em produção é a mesma
  // URL do webhook (ex: https://hooks.example.com).
  PUBLIC_API_URL: z.string().default("http://localhost:4000"),
  // RNF10 — base pública do dashboard, usada pra montar o link de login por
  // e-mail (`{PUBLIC_APP_URL}/login/verify?token=...`).
  PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  // Envio de e-mail do magic-link via Resend. Sem chave configurada, o link
  // só é impresso no console (dev/local) — mesmo padrão de fallback já usado
  // pra Graph API sem token (ver worker/src/services/instagram.ts).
  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("DMFlow <login@dmflow.example.com>"),
});

export const env = schema.parse(process.env);
