import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://redis:6379"),
  JWT_SECRET: z.string().min(16),
  META_APP_SECRET: z.string().default(""),
  META_VERIFY_TOKEN: z.string().default(""),
  META_PAGE_ACCESS_TOKEN: z.string().default(""),
});

export const env = schema.parse(process.env);
