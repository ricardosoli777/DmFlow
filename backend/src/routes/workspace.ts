import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env";
import { requireRole } from "../lib/auth";
import { prisma } from "../lib/prisma";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60_000; // 7 dias

// RF16 — workspace atual: nome, membros e convites (por link — quem recebe
// copia e manda pra pessoa; não envia e-mail sozinho, ver docs/05-dashboard.md).
export async function workspaceRoutes(app: FastifyInstance) {
  app.get("/workspace", async (req) => {
    return prisma.workspace.findUniqueOrThrow({ where: { id: req.workspaceId } });
  });

  app.patch("/workspace", { preHandler: requireRole("OWNER", "ADMIN") }, async (req) => {
    const body = z.object({ name: z.string().min(1) }).parse(req.body);
    return prisma.workspace.update({ where: { id: req.workspaceId }, data: { name: body.name } });
  });

  app.get("/workspace/members", async (req) => {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: req.workspaceId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    return members.map((m) => ({ id: m.id, role: m.role, email: m.user.email, createdAt: m.createdAt }));
  });

  app.patch(
    "/workspace/members/:id",
    { preHandler: requireRole("OWNER") },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = z.object({ role: z.enum(["OWNER", "ADMIN", "MEMBER"]) }).parse(req.body);

      const member = await prisma.workspaceMember.findUnique({ where: { id } });
      if (!member || member.workspaceId !== req.workspaceId) return reply.status(404).send({ error: "not found" });

      return prisma.workspaceMember.update({ where: { id }, data: { role: body.role } });
    },
  );

  app.delete(
    "/workspace/members/:id",
    { preHandler: requireRole("OWNER") },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const member = await prisma.workspaceMember.findUnique({ where: { id } });
      if (!member || member.workspaceId !== req.workspaceId) return reply.status(404).send({ error: "not found" });
      if (member.userId === req.userId) {
        return reply.status(400).send({ error: "Não dá pra se remover — peça pra outro owner remover você" });
      }

      await prisma.workspaceMember.delete({ where: { id } });
      return reply.status(204).send();
    },
  );

  app.get("/workspace/invitations", { preHandler: requireRole("OWNER", "ADMIN") }, async (req) => {
    return prisma.workspaceInvitation.findMany({
      where: { workspaceId: req.workspaceId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post(
    "/workspace/invitations",
    { preHandler: requireRole("OWNER", "ADMIN") },
    async (req, reply) => {
      const body = z
        .object({ email: z.string().email(), role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER") })
        .parse(req.body);

      const token = randomUUID();
      const invitation = await prisma.workspaceInvitation.create({
        data: {
          workspaceId: req.workspaceId,
          email: body.email,
          role: body.role,
          token,
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        },
      });

      const inviteUrl = `${env.PUBLIC_APP_URL}/login?invitation=${token}`;
      return reply.status(201).send({ ...invitation, inviteUrl });
    },
  );

  app.delete(
    "/workspace/invitations/:id",
    { preHandler: requireRole("OWNER", "ADMIN") },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const invitation = await prisma.workspaceInvitation.findUnique({ where: { id } });
      if (!invitation || invitation.workspaceId !== req.workspaceId) {
        return reply.status(404).send({ error: "not found" });
      }
      await prisma.workspaceInvitation.delete({ where: { id } });
      return reply.status(204).send();
    },
  );
}
