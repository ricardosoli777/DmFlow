import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { assertCredentialsEncryptionKey, encryptStoredInstagramCredentials } from "@dmflow/db";
import Fastify from "fastify";
import { env } from "./env";
import { requireAuth } from "./lib/auth";
import { activatePendingZernioWebhooks } from "./lib/zernio-webhook";
import { authRoutes } from "./routes/auth";
import { contactRoutes } from "./routes/contacts";
import { flowRoutes } from "./routes/flows";
import { instagramAccountRoutes } from "./routes/instagram-accounts";
import { instagramMediaRoutes } from "./routes/instagram-media";
import { linkRedirectRoutes } from "./routes/link-redirect";
import { messageRoutes } from "./routes/messages";
import { metricsRoutes } from "./routes/metrics";
import { metaOAuthCallbackRoutes, metaOAuthStartRoutes } from "./routes/meta-oauth";
import { trackedLinkRoutes } from "./routes/tracked-links";
import { triggerRoutes } from "./routes/triggers";
import { webhookRoutes } from "./routes/webhooks";
import { workspaceRoutes } from "./routes/workspace";
import { zernioRoutes } from "./routes/zernio";

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
  assertCredentialsEncryptionKey();
  const encryptedAccounts = await encryptStoredInstagramCredentials();
  if (encryptedAccounts) app.log.info({ encryptedAccounts }, "Credenciais Meta legadas cifradas");

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: env.JWT_SECRET });

  app.get("/health", async () => ({ status: "ok" }));

  // Público — sem JWT nem workspace: é a Meta chamando (webhooks), o link
  // que sai numa DM (redirect), ou o próprio login (auth).
  await app.register(webhookRoutes);
  await app.register(authRoutes);
  await app.register(linkRedirectRoutes);
  await app.register(metaOAuthCallbackRoutes);
  await app.register(zernioRoutes);

  // RF16/RNF10 — tudo daqui pra baixo exige JWT válido + membership no
  // workspace informado em X-Workspace-Id (achado: antes desta wave NENHUMA
  // rota validava o token — ver backend/src/lib/auth.ts).
  await app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", requireAuth);

    await protectedApp.register(workspaceRoutes);
    await protectedApp.register(triggerRoutes);
    await protectedApp.register(flowRoutes);
    await protectedApp.register(contactRoutes);
    await protectedApp.register(messageRoutes);
    await protectedApp.register(metricsRoutes);
    await protectedApp.register(instagramAccountRoutes);
    await protectedApp.register(metaOAuthStartRoutes);
    await protectedApp.register(instagramMediaRoutes);
    await protectedApp.register(trackedLinkRoutes);
  });

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  void activatePendingZernioWebhooks();
}

bootstrap().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
