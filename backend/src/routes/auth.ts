import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { verifyPassword } from "../lib/password";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// RNF07 — login único (uso pessoal), sem cadastro público
export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (req, reply) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return reply.status(401).send({ error: "credenciais inválidas" });
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return { token };
  });
}
