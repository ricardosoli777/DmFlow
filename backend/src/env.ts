import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://redis:6379"),
  JWT_SECRET: z.string().min(16),
  META_CREDENTIALS_ENCRYPTION_KEY: z.string().min(1),
  // RF14 — base pública do backend, usada pra montar a URL de redirect dos
  // links rastreados (`{PUBLIC_API_URL}/r/{code}`). Em produção é a mesma
  // URL do webhook (ex: https://hooks.example.com).
  PUBLIC_API_URL: z.string().default("http://localhost:4000"),
  // RNF10 — base pública do dashboard, usada pra montar o link de login por
  // e-mail (`{PUBLIC_APP_URL}/login/verify?token=...`).
  PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  // OAuth de uso pessoal da Meta. META_OAUTH_PAGE_ID é opcional: quando a
  // Meta omite uma Página em /me/accounts, permite buscar diretamente a
  // Página que o proprietário escolheu no Business Suite.
  // Os nomes META_APP_* são mantidos por compatibilidade com instalações
  // existentes. Os META_OAUTH_* permitem sobrescrever somente quando o
  // login usar outro app da Meta.
  META_APP_ID: z.string().default(""),
  META_APP_SECRET: z.string().default(""),
  META_OAUTH_APP_ID: z.string().default(""),
  META_OAUTH_APP_SECRET: z.string().default(""),
  META_OAUTH_REDIRECT_URI: z.string().url().or(z.literal("")).default(""),
  META_OAUTH_PAGE_ID: z.string().regex(/^\d*$/).default(""),
  ZERNIO_API_KEY: z.string().default(""),
  // Envio de e-mail do magic-link — duas opções, nessa ordem de prioridade
  // (ver backend/src/lib/email.ts e README.md "Login por e-mail"):
  // 1. Resend (RESEND_API_KEY) — recomendado, precisa de domínio verificado.
  // 2. Gmail com senha de app (GMAIL_USER/GMAIL_APP_PASSWORD) — sem domínio,
  //    mas limite baixo de envio (~500/dia) e mais chance de cair em spam.
  // Sem nenhuma das duas, o link só é impresso no console (dev/local) —
  // mesmo padrão de fallback já usado pra Graph API sem token (ver
  // worker/src/services/instagram.ts).
  RESEND_API_KEY: z.string().default(""),
  GMAIL_USER: z.string().default(""),
  GMAIL_APP_PASSWORD: z.string().default(""),
  EMAIL_FROM: z.string().default("DMFlow <login@dmflow.example.com>"),
});

const configured = schema.parse(process.env);

export const env = {
  ...configured,
  META_OAUTH_APP_ID: configured.META_OAUTH_APP_ID || configured.META_APP_ID,
  META_OAUTH_APP_SECRET: configured.META_OAUTH_APP_SECRET || configured.META_APP_SECRET,
  META_OAUTH_REDIRECT_URI: configured.META_OAUTH_REDIRECT_URI || `${configured.PUBLIC_API_URL}/oauth/meta/callback`,
  ZERNIO_API_KEY: configured.ZERNIO_API_KEY,
};
