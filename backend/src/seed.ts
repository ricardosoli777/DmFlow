// Garante que o e-mail admin (DASHBOARD_ADMIN_EMAIL) já tenha um workspace
// pronto no primeiro boot — RNF10: sem senha, o login em si é só magic-link.
// Idempotente: numa instalação já migrada (ver
// packages/db/prisma/migrations/20260915120301_workspaces_backfill_default),
// esse usuário e seu workspace já existem e nada é recriado aqui.
import { prisma } from "./lib/prisma";

async function seed() {
  const email = process.env.DASHBOARD_ADMIN_EMAIL;

  if (!email) {
    console.log("DASHBOARD_ADMIN_EMAIL não definido — pulando seed.");
    return;
  }

  const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email } });

  const hasWorkspace = await prisma.workspaceMember.findFirst({ where: { userId: user.id } });
  if (!hasWorkspace) {
    const workspace = await prisma.workspace.create({ data: { name: "Minha Automação" } });
    await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" } });
    console.log(`Workspace "Minha Automação" criado pra ${email}.`);
  }

  console.log(`Usuário admin pronto: ${email} — faça login por magic-link em /login.`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
