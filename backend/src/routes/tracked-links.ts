import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env";
import { prisma } from "../lib/prisma";

const createSchema = z.object({
  label: z.string().min(1),
  destinationUrl: z.string().url(),
});

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  destinationUrl: z.string().url().optional(),
});

function generateCode(): string {
  return randomBytes(6).toString("base64url"); // 8 chars, URL-safe
}

function toRedirectUrl(code: string): string {
  return `${env.PUBLIC_API_URL}/r/${code}`;
}

// RF14 — links rastreados: o redirect público em si (`GET /r/:code`) vive em
// link-redirect.ts (sem auth) — aqui só o CRUD, protegido e workspace-scoped.
export async function trackedLinkRoutes(app: FastifyInstance) {
  app.get("/tracked-links", async (req) => {
    const links = await prisma.trackedLink.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { clicks: true } } },
    });
    return links.map((l) => ({
      id: l.id,
      label: l.label,
      destinationUrl: l.destinationUrl,
      code: l.code,
      redirectUrl: toRedirectUrl(l.code),
      clicks: l._count.clicks,
      createdAt: l.createdAt,
    }));
  });

  app.post("/tracked-links", async (req, reply) => {
    const body = createSchema.parse(req.body);
    let code = generateCode();
    // colisão é raríssima (6 bytes aleatórios), mas não custa garantir
    while (await prisma.trackedLink.findUnique({ where: { code } })) code = generateCode();

    const link = await prisma.trackedLink.create({
      data: { workspaceId: req.workspaceId, label: body.label, destinationUrl: body.destinationUrl, code },
    });
    return reply.status(201).send({ ...link, redirectUrl: toRedirectUrl(link.code) });
  });

  app.patch("/tracked-links/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = updateSchema.parse(req.body);
    const exists = await prisma.trackedLink.findUnique({ where: { id } });
    if (!exists || exists.workspaceId !== req.workspaceId) return reply.status(404).send({ error: "not found" });

    const link = await prisma.trackedLink.update({ where: { id }, data: body });
    return { ...link, redirectUrl: toRedirectUrl(link.code) };
  });

  app.delete("/tracked-links/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const exists = await prisma.trackedLink.findUnique({ where: { id } });
    if (!exists || exists.workspaceId !== req.workspaceId) return reply.status(404).send({ error: "not found" });

    await prisma.$transaction([
      prisma.linkClick.deleteMany({ where: { trackedLinkId: id } }),
      prisma.trackedLink.delete({ where: { id } }),
    ]);
    return reply.status(204).send();
  });
}
