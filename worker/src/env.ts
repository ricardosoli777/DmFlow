import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://redis:6379"),
  // RF14 — mesmo backend que serve `GET /r/:code` (ver backend/src/env.ts);
  // usada só pra montar a URL de link rastreado num botão de node.
  PUBLIC_API_URL: z.string().default("http://localhost:4000"),
});

export const env = schema.parse(process.env);
