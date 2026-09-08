// Cria o usuário admin inicial a partir das variáveis de ambiente.
// Rodado automaticamente no primeiro `docker compose up` (ver infra/entrypoint).
import { hashPassword } from "./lib/password";
import { prisma } from "./lib/prisma";

async function seed() {
  const email = process.env.DASHBOARD_ADMIN_EMAIL;
  const password = process.env.DASHBOARD_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("DASHBOARD_ADMIN_EMAIL/PASSWORD não definidos — pulando seed.");
    return;
  }

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: hashPassword(password) },
  });

  console.log(`Usuário admin pronto: ${email}`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
