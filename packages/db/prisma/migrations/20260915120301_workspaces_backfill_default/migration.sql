-- RF16/RF17 — migração de dados de uma instalação single-tenant (antes desta
-- wave) pra multi-tenant: cria um workspace padrão e move tudo que já
-- existia pra dentro dele. Não faz nada numa instalação nova (sem usuários
-- ainda nesse ponto — `migrate deploy` roda antes do seed, ver
-- docker-compose.yml), então é seguro rodar em qualquer instalação.

-- Só cria o workspace padrão se já existir pelo menos um usuário (instalação
-- sendo atualizada) — instalação nova fica sem workspace fantasma; o
-- primeiro login por magic-link cria o dele próprio (ver backend/src/seed.ts).
INSERT INTO "workspaces" ("id", "name", "createdAt")
SELECT 'e26030e1-81a6-4658-baf4-f45ef52ebb97', 'Minha Automação', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "users")
ON CONFLICT ("id") DO NOTHING;

-- Todo usuário que já existia vira OWNER do workspace padrão.
INSERT INTO "workspace_members" ("id", "workspaceId", "userId", "role", "createdAt")
SELECT gen_random_uuid()::text, 'e26030e1-81a6-4658-baf4-f45ef52ebb97', "id", 'OWNER', CURRENT_TIMESTAMP
FROM "users"
ON CONFLICT ("workspaceId", "userId") DO NOTHING;

-- A conexão Instagram única (settings.instagram_connection) vira a primeira
-- InstagramAccount do workspace padrão. igUserId nunca configurado (string
-- vazia) ganha um placeholder único, já que a coluna é NOT NULL/UNIQUE daqui
-- pra frente — precisa ser reconfigurado em Configurações de qualquer jeito.
INSERT INTO "instagram_accounts"
  ("id", "workspaceId", "appId", "appSecret", "verifyToken", "pageAccessToken", "igUserId", "igUsername", "graphApiVersion", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'e26030e1-81a6-4658-baf4-f45ef52ebb97',
  COALESCE("value"->>'appId', ''),
  COALESCE("value"->>'appSecret', ''),
  COALESCE("value"->>'verifyToken', ''),
  COALESCE("value"->>'pageAccessToken', ''),
  COALESCE(NULLIF("value"->>'igUserId', ''), 'legacy-' || gen_random_uuid()::text),
  COALESCE("value"->>'igUsername', ''),
  COALESCE(NULLIF("value"->>'graphApiVersion', ''), 'v21.0'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "settings"
WHERE "key" = 'instagram_connection'
ON CONFLICT ("igUserId") DO NOTHING;

-- Dados existentes (contatos, flows, triggers, links) migram pro workspace padrão.
UPDATE "contacts" SET "workspaceId" = 'e26030e1-81a6-4658-baf4-f45ef52ebb97' WHERE "workspaceId" IS NULL;
UPDATE "flows" SET "workspaceId" = 'e26030e1-81a6-4658-baf4-f45ef52ebb97' WHERE "workspaceId" IS NULL;
UPDATE "posts_triggers" SET "workspaceId" = 'e26030e1-81a6-4658-baf4-f45ef52ebb97' WHERE "workspaceId" IS NULL;
UPDATE "tracked_links" SET "workspaceId" = 'e26030e1-81a6-4658-baf4-f45ef52ebb97' WHERE "workspaceId" IS NULL;

-- Só existia uma conta Instagram antes desta wave, então todo contato
-- existente só pode ter vindo dela — preenche instagramAccountId com ela.
UPDATE "contacts" c
SET "instagramAccountId" = ia."id"
FROM "instagram_accounts" ia
WHERE ia."workspaceId" = 'e26030e1-81a6-4658-baf4-f45ef52ebb97'
  AND c."instagramAccountId" IS NULL;

-- events_raw fica com workspaceId NULL pros eventos antigos (a coluna
-- continua opcional na versão final do schema) — não dá pra saber com
-- certeza a qual conta cada payload bruto pertencia sem reprocessar.
