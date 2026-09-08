import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import Fastify from "fastify";
import { env } from "./env";
import { authRoutes } from "./routes/auth";
import { contactRoutes } from "./routes/contacts";
import { flowRoutes } from "./routes/flows";
import { messageRoutes } from "./routes/messages";
import { metricsRoutes } from "./routes/metrics";
import { triggerRoutes } from "./routes/triggers";
import { webhookRoutes } from "./routes/webhooks";

const app = Fastify({ logger: true });

// RNF03: precisamos do corpo bruto pra validar a assinatura HMAC do webhook da Meta
app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
  (req as any).rawBody = body;
  try {
    done(null, body.length ? JSON.parse(body.toString()) : {});
  } catch (err) {
    done(err as Error, undefined);
  }
});

async function bootstrap() {
  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: env.JWT_SECRET });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(webhookRoutes);
  await app.register(authRoutes);
  await app.register(triggerRoutes);
  await app.register(flowRoutes);
  await app.register(contactRoutes);
  await app.register(messageRoutes);
  await app.register(metricsRoutes);

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

bootstrap().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
