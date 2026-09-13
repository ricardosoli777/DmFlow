-- AlterTable: contacts ganha username (nome de usuário do Instagram, quando disponível)
ALTER TABLE "contacts" ADD COLUMN "username" TEXT;

-- AlterTable: posts_triggers ganha "type" (comment | dm_keyword) e postId vira opcional
-- (trigger de DM não está associado a nenhum post)
ALTER TABLE "posts_triggers" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'comment';
ALTER TABLE "posts_triggers" ALTER COLUMN "postId" DROP NOT NULL;

-- AlterTable: flow_runs ganha triggerId, pra saber qual trigger originou o flow
-- (dashboard/inbox mostram "de onde o contato veio")
ALTER TABLE "flow_runs" ADD COLUMN "triggerId" TEXT;

-- AddForeignKey
ALTER TABLE "flow_runs" ADD CONSTRAINT "flow_runs_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "posts_triggers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
