import { getPrisma } from "./index";

export type MetaSettings = {
  appId: string;
  appSecret: string;
  verifyToken: string;
  pageAccessToken: string;
  igUserId: string;
  igUsername: string;
  graphApiVersion: string;
};

const SETTING_KEY = "instagram_connection";
const CACHE_TTL_MS = 15_000;

let cache: { value: MetaSettings; expiresAt: number } | null = null;

// Lê a conexão salva no banco (editável pelo dashboard); cai pro .env se
// nunca foi configurada por lá. Cacheado por 15s pra não bater no banco em
// todo evento de webhook.
export async function getMetaSettings(): Promise<MetaSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const prisma = getPrisma();
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  const stored = (row?.value as Partial<MetaSettings>) ?? {};

  const value: MetaSettings = {
    appId: stored.appId || process.env.META_APP_ID || "",
    appSecret: stored.appSecret || process.env.META_APP_SECRET || "",
    verifyToken: stored.verifyToken || process.env.META_VERIFY_TOKEN || "",
    pageAccessToken: stored.pageAccessToken || process.env.META_PAGE_ACCESS_TOKEN || "",
    igUserId: stored.igUserId || process.env.META_IG_USER_ID || "",
    igUsername: stored.igUsername || "",
    graphApiVersion: stored.graphApiVersion || process.env.META_GRAPH_API_VERSION || "v21.0",
  };

  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function saveMetaSettings(partial: Partial<MetaSettings>): Promise<MetaSettings> {
  const prisma = getPrisma();
  const current = await getMetaSettings();
  const merged: MetaSettings = { ...current, ...partial };

  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: merged as unknown as object },
    update: { value: merged as unknown as object },
  });

  cache = null;
  return merged;
}
