import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://redis:6379"),
  META_PAGE_ACCESS_TOKEN: z.string().default(""),
});

export const env = schema.parse(process.env);
