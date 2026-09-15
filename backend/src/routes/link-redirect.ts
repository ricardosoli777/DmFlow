import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// RF14 — redirect público (sem auth, é o link que sai na DM pro contato).
// Fica num arquivo à parte de tracked-links.ts pra não entrar sem querer no
// contexto protegido (X-Workspace-Id/JWT) registrado em backend/src/index.ts.
export async function linkRedirectRoutes(app: FastifyInstance) {
  app.get("/r/:code", async (req, reply) => {
    const { code } = req.params as { code: string };
    const link = await prisma.trackedLink.findUnique({ where: { code } });
    if (!link) return reply.status(404).send({ error: "not found" });

    await prisma.linkClick.create({ data: { trackedLinkId: link.id } });
    return reply.redirect(302, link.destinationUrl);
  });
}
