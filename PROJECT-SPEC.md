# PROJECT-SPEC.md — DMFlow

Consolidação de [`docs/01-visao-geral.md`](docs/01-visao-geral.md) até
[`docs/06-roadmap.md`](docs/06-roadmap.md) em requisitos verificáveis.
Fonte de verdade pro loop SPEC→PLAN→EXECUTE→VERIFY de cada wave
(ver [`docs/07-plano-waves-spec-driven.md`](docs/07-plano-waves-spec-driven.md)).

## Requisitos Funcionais

| ID | Requisito | Critério de aceite |
|---|---|---|
| RF01 | Detectar comentário em post/reel monitorado | Webhook `comments` da Meta processado em <5s, evento gravado em `events_raw` |
| RF02 | Filtrar por palavra-chave opcional | Comentário sem a palavra-chave configurada não dispara nenhum flow |
| RF03 | Enviar Private Reply / DM inicial | Usuário que comentou recebe DM em até 10s do comentário |
| RF04 | Executar fluxo conversacional configurável | Grafo salvo no dashboard roda idêntico ao desenhado, sem lógica hardcoded |
| RF05 | Node de mensagem, botões, delay, condição, captura, tag, webhook, fim | Cada tipo tem teste automatizado cobrindo seu comportamento isolado — ver `worker/src/engine/__tests__/node-handlers.test.ts`. O node `delay` agenda de verdade (job atrasado via fila `flow-resume`, não só avança pro próximo node) — ver `executor.test.ts` |
| RF06 | Capturar dado do usuário (nome/telefone/email) | Resposta livre do usuário em node `capture` é persistida no contato |
| RF07 | Segmentar contatos por tag | Filtro por tag no dashboard retorna só os contatos correspondentes |
| RF08 | Integrar com sistema externo via webhook de saída | Node `webhook` chama URL configurada e loga sucesso/falha |
| RF09 | Dashboard: CRUD de triggers | Criar/editar/pausar trigger reflete no comportamento real em até 1 min |
| RF10 | Dashboard: editor visual de fluxo | Fluxo criado só pela UI roda no engine sem edição manual de JSON |
| RF11 | Dashboard: inbox com intervenção manual | Mensagem manual enviada pela UI chega de fato no Instagram do contato — `POST /contacts/:id/messages` enfileira (`manual-sends`), o worker chama `sendDirectMessage` de verdade; thread completa visível em `/inbox` |
| RF12 | Métricas de funil | Dashboard mostra contagem de contatos por node do fluxo |
| RF13 | Ignorar comentário da própria conta conectada | Comentário com `fromIgsid == igUserId` não cria `contact` nem `flow_run` — ver `worker/src/engine/resolve-event.ts` e `resolve-event.test.ts` |
| RF14 | Links rastreados com métrica de clique | Link criado em `/links` gera um redirect público (`GET /r/:code`); botão de node pode usar esse link em vez de URL direta; clique é registrado e contagem aparece na tela |
| RF15 | Follow gate opcional num botão de node | Botão marcado com "exigir seguir" só libera o `next` depois de `is_user_follow_business = true`; erro/campo ausente da Graph API nunca bloqueia permanentemente (fail-open) — ver `checkFollowStatus` em `worker/src/services/instagram.ts` |
| RF16 | Workspaces com papéis e convite por link | Cada workspace isola seus próprios contatos/flows/triggers/links; membros têm papel OWNER/ADMIN/MEMBER; convite gera um link (`/settings/team`) que, ao ser aberto e logado com o e-mail convidado, vira membro automaticamente |
| RF17 | Múltiplas contas Instagram por workspace | `/settings` lista N contas conectadas (cada uma com App ID/Secret/tokens próprios); um evento de webhook é roteado pra conta certa via `entry[].id` do payload — ver `worker/src/index.ts` e `extractAccountIgUserId`; `/triggers` deixa escolher de qual conta puxar os posts/reels quando há mais de uma conectada |

## Requisitos Não Funcionais

| ID | Requisito | Critério de aceite |
|---|---|---|
| RNF01 | Respeitar janela de 24h de mensagens da Meta | Envio fora da janela é bloqueado e logado, nunca falha silenciosamente nem quebra o flow_run |
| RNF02 | Resiliência a picos/falhas | Webhook sempre responde 200 rápido; processamento real é assíncrono via fila com retry |
| RNF03 | Segurança do webhook | Toda requisição é validada via HMAC (`X-Hub-Signature-256`); payload inválido é rejeitado com 401 |
| RNF04 | Auditoria | Todo evento bruto recebido da Meta é persistido em `events_raw`, permitindo replay |
| RNF05 | Reprodutibilidade total | Clone limpo do repo + Docker sobe o app funcional sem instalar Node/Postgres/Redis manualmente |
| RNF06 | Onboarding leigo | Pessoa sem conhecimento técnico segue só o `README.md` e sobe o app em até 15 minutos |
| RNF07 | Sem exposição de segredos | Nenhuma credencial committada no repositório público; credenciais de infra via `.env`, credenciais da Meta configuradas por cada usuário em **Configurações**, guardadas no banco |
| RNF08 | Observabilidade mínima | `messages_log` tem `status` (`ok\|skipped\|failed\|rate_limited\|follow_gate_pending`) e `reason` estruturados — dá pra diagnosticar falha/skip de envio sem ler log bruto nem acessar o código. Ver `worker/src/services/instagram.ts` |
| RNF09 | Respeitar o rate limit de private replies da Meta (750/h por conta) | Acima de 740 envios/h, o node é reagendado automaticamente (nunca falha nem perde a mensagem) e fica logado como `rate_limited` — ver `checkSendRateLimit` em `worker/src/services/instagram.ts` |
| RNF10 | Autenticação via magic-link, sem senha armazenada | `User` não tem `passwordHash`; login é só e-mail → link de uso único (15min) → JWT; toda rota protegida exige o JWT válido + membership no workspace do header `X-Workspace-Id` — ver `backend/src/lib/auth.ts` |

## Fora de escopo (v1)

- Broadcast em massa
- A/B testing de fluxo
- Resposta gerada por IA dentro do node (backlog, ver `docs/06-roadmap.md`)

## Rastreabilidade

Cada requisito acima é referenciado pelas etapas das Waves 1-4 em
[`docs/07-plano-waves-spec-driven.md`](docs/07-plano-waves-spec-driven.md).
Nenhuma etapa é considerada "VERIFY ok" sem apontar de volta pra pelo menos
um RF/RNF daqui.
