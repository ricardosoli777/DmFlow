import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env";
import { magicLinkEmailHtml, sendTransactionalEmail } from "../lib/email";
import { prisma } from "../lib/prisma";

const MAGIC_LINK_TTL_MS = 15 * 60_000;

const requestSchema = z.object({ email: z.string().email(), invitationToken: z.string().optional() });
const verifySchema = z.object({ token: z.string(), invitation: z.string().optional(), flow: z.enum(["login", "register"]).default("login") });

// RNF10 — sem senha: login é sempre por link de e-mail de uso único, válido
// por 15 minutos. Substitui o antigo login único email/senha (RF16).
export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/magic-link", async (req) => {
    const body = requestSchema.parse(req.body);
    const email = body.email.trim().toLowerCase();
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (!user) return { status: "registration_required" };

    await sendMagicLink(user.email, "LOGIN", body.invitationToken);
    return { status: "sent" };
  });

  app.post("/auth/register", async (req) => {
    const body = requestSchema.parse(req.body);
    const email = body.email.trim().toLowerCase();
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (user) return { status: "already_registered" };

    await sendMagicLink(email, "REGISTER", body.invitationToken);
    return { status: "sent" };
  });

  async function sendMagicLink(email: string, purpose: "LOGIN" | "REGISTER", invitationToken?: string) {
    const token = randomUUID();
    await prisma.magicLinkToken.create({
      data: { email, token, purpose, expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS) },
    });

    const params = new URLSearchParams({ token });
    if (purpose === "REGISTER") params.set("flow", "register");
    if (invitationToken) params.set("invitation", invitationToken);
    const verifyUrl = `${env.PUBLIC_APP_URL}/login/verify?${params}`;
    await sendTransactionalEmail(
      email,
      purpose === "REGISTER" ? "Confirme seu cadastro no DMFlow" : "Seu link de acesso ao DMFlow",
      magicLinkEmailHtml(verifyUrl, purpose === "REGISTER" ? "cadastro" : "login"),
    );
  }

  app.get("/auth/magic-link/verify", async (req, reply) => {
    const query = verifySchema.parse(req.query);

    const magicLink = await prisma.magicLinkToken.findUnique({ where: { token: query.token } });
    const purpose = query.flow === "register" ? "REGISTER" : "LOGIN";
    if (!magicLink || magicLink.purpose !== purpose || magicLink.usedAt || magicLink.expiresAt < new Date()) {
      return reply.status(400).send({ error: "Link inválido ou expirado — peça um novo login" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: magicLink.email } });
    if (purpose === "LOGIN" && !existingUser) {
      return reply.status(400).send({ error: "Conta não encontrada — faça o cadastro" });
    }

    const consumed = await prisma.magicLinkToken.updateMany({
      where: { token: query.token, usedAt: null, expiresAt: { gt: new Date() }, purpose },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      return reply.status(400).send({ error: "Link inválido ou expirado — peça um novo login" });
    }

    const user = existingUser ?? await prisma.user.upsert({
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
