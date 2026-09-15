import type { WorkspaceRole } from "@dmflow/db";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./prisma";

declare module "fastify" {
  interface FastifyRequest {
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
  }
}

/**
 * RNF10/RF16 — toda rota protegida exige um JWT válido (achado ao portar
 * essa wave: antes dela NENHUMA rota validava o token — `@fastify/jwt`
 * estava registrado mas nada chamava `jwtVerify`) e um workspace do qual o
 * usuário seja membro, informado no header `X-Workspace-Id` (o dashboard
 * manda esse header em toda chamada — ver frontend/lib/api.ts).
 */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await req.jwtVerify();
  const userId = (req.user as { sub: string }).sub;

  const workspaceId = req.headers["x-workspace-id"] as string | undefined;
  if (!workspaceId) {
    return reply.status(400).send({ error: "Header X-Workspace-Id obrigatório" });
  }

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) {
    return reply.status(403).send({ error: "Sem acesso a este workspace" });
  }

  req.workspaceId = workspaceId;
  req.userId = userId;
  req.role = member.role;
}

/** Uso: `app.post(path, { preHandler: requireRole("OWNER", "ADMIN") }, handler)`. */
export function requireRole(...roles: WorkspaceRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!roles.includes(req.role)) {
      return reply.status(403).send({ error: "Sem permissão pra essa ação" });
    }
  };
}
