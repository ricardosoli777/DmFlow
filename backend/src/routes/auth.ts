import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env";
import { magicLinkEmailHtml, sendTransactionalEmail } from "../lib/email";
import { prisma } from "../lib/prisma";

const MAGIC_LINK_TTL_MS = 15 * 60_000;

const requestSchema = z.object({ email: z.string().email(), invitationToken: z.string().optional() });
const verifySchema = z.object({ token: z.string(), invitation: z.string().optional() });

// RNF10 — sem senha: login é sempre por link de e-mail de uso único, válido
// por 15 minutos. Substitui o antigo login único email/senha (RF16).
export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/magic-link", async (req) => {
    const body = requestSchema.parse(req.body);

    const token = randomUUID();
    await prisma.magicLinkToken.create({
      data: { email: body.email, token, expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS) },
    });

    const invitationParam = body.invitationToken ? `&invitation=${encodeURIComponent(body.invitationToken)}` : "";
    const verifyUrl = `${env.PUBLIC_APP_URL}/login/verify?token=${token}${invitationParam}`;
    await sendTransactionalEmail(body.email, "Seu link de acesso ao DMFlow", magicLinkEmailHtml(verifyUrl));

    return { sent: true };
  });

  app.get("/auth/magic-link/verify", async (req, reply) => {
    const query = verifySchema.parse(req.query);

    const magicLink = await prisma.magicLinkToken.findUnique({ where: { token: query.token } });
    if (!magicLink || magicLink.usedAt || magicLink.expiresAt < new Date()) {
      return reply.status(400).send({ error: "Link inválido ou expirado — peça um novo login" });
    }
    await prisma.magicLinkToken.update({ where: { token: query.token }, data: { usedAt: new Date() } });

    const user = await prisma.user.upsert({
      where: { email: magicLink.email },
      update: {},
      create: { email: magicLink.email },
    });

    if (query.invitation) {
      await acceptInvitationIfValid(query.invitation, user.id, user.email);
    }

    // Primeiro login sem convite nenhum: ganha um workspace próprio, senão
    // ficaria sem lugar nenhum pra entrar.
    const hasWorkspace = await prisma.workspaceMember.findFirst({ where: { userId: user.id } });
    if (!hasWorkspace) {
      const workspace = await prisma.workspace.create({ data: { name: `Workspace de ${user.email}` } });
      await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" } });
    }

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });

    const jwtToken = app.jwt.sign({ sub: user.id, email: user.email });
    return {
      token: jwtToken,
      workspaces: memberships.map((m) => ({ id: m.workspaceId, name: m.workspace.name, role: m.role })),
    };
  });
}

async function acceptInvitationIfValid(invitationToken: string, userId: string, userEmail: string): Promise<void> {
  const invitation = await prisma.workspaceInvitation.findUnique({ where: { token: invitationToken } });
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) return;
  if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) return;

  await prisma.$transaction([
    prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
      update: {},
      create: { workspaceId: invitation.workspaceId, userId, role: invitation.role },
    }),
    prisma.workspaceInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } }),
  ]);
}
