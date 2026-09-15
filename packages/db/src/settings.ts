import { randomUUID } from "node:crypto";
import type { InstagramAccount } from "@prisma/client";
import { getPrisma } from "./index";

const CACHE_TTL_MS = 15_000;
const cacheById = new Map<string, { value: InstagramAccount; expiresAt: number }>();

export type InstagramAccountInput = {
  appId?: string;
  appSecret?: string;
  verifyToken?: string;
  pageAccessToken?: string;
  igUserId?: string;
  igUsername?: string;
  graphApiVersion?: string;
};

/**
 * RF17 — substitui a antiga `getMetaSettings()` (linha única global). Cada
 * conta é lida pelo próprio `id` (workspace-scoped na camada de rotas —
 * ver backend/src/routes/settings.ts), cacheada por 15s pra não bater no
 * banco em todo evento de webhook/envio.
 */
export async function getInstagramAccount(id: string): Promise<InstagramAccount | null> {
  const cached = cacheById.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const prisma = getPrisma();
  const account = await prisma.instagramAccount.findUnique({ where: { id } });
  if (account) cacheById.set(id, { value: account, expiresAt: Date.now() + CACHE_TTL_MS });
  return account;
}

/**
 * Usado só na entrada do pipeline (worker/src/index.ts): descobre a qual
 * conta/workspace um evento de webhook pertence, a partir do `entry[].id`
 * do payload (ID da conta na própria Instagram) — é o único jeito de saber
 * o workspace antes de qualquer outro dado.
 */
export async function getInstagramAccountByIgUserId(igUserId: string): Promise<InstagramAccount | null> {
  const prisma = getPrisma();
  return prisma.instagramAccount.findUnique({ where: { igUserId } });
}

export async function listInstagramAccounts(workspaceId: string): Promise<InstagramAccount[]> {
  const prisma = getPrisma();
  return prisma.instagramAccount.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
}

/**
 * `id: null` cria uma conta nova (rascunho — pode ainda não saber o
 * `igUserId` de verdade, por isso o placeholder único abaixo) pra permitir
 * salvar campo por campo como o form de Configurações já fazia antes.
 */
export async function saveInstagramAccount(
  workspaceId: string,
  id: string | null,
  partial: InstagramAccountInput,
): Promise<InstagramAccount> {
  const prisma = getPrisma();
  const account = id
    ? await prisma.instagramAccount.update({ where: { id }, data: partial })
    : await prisma.instagramAccount.create({
        data: { workspaceId, ...partial, igUserId: partial.igUserId || `pending-${randomUUID()}` },
      });

  cacheById.delete(account.id);
  return account;
}

export async function deleteInstagramAccount(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.instagramAccount.delete({ where: { id } });
  cacheById.delete(id);
}
