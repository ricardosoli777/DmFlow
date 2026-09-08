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
| RF05 | Node de mensagem, botões, delay, condição, captura, tag, webhook, fim | Cada tipo tem teste automatizado cobrindo seu comportamento isolado |
| RF06 | Capturar dado do usuário (nome/telefone/email) | Resposta livre do usuário em node `capture` é persistida no contato |
| RF07 | Segmentar contatos por tag | Filtro por tag no dashboard retorna só os contatos correspondentes |
| RF08 | Integrar com sistema externo via webhook de saída | Node `webhook` chama URL configurada e loga sucesso/falha |
| RF09 | Dashboard: CRUD de triggers | Criar/editar/pausar trigger reflete no comportamento real em até 1 min |
| RF10 | Dashboard: editor visual de fluxo | Fluxo criado só pela UI roda no engine sem edição manual de JSON |
| RF11 | Dashboard: inbox com intervenção manual | Mensagem manual enviada pela UI chega de fato no Instagram do contato |
| RF12 | Métricas de funil | Dashboard mostra contagem de contatos por node do fluxo |

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
| RNF08 | Observabilidade mínima | Logs estruturados suficientes para diagnosticar falha de envio de DM sem acesso ao código |

## Fora de escopo (v1)

- Multi-conta / multi-tenant (SaaS)
- Broadcast em massa
- A/B testing de fluxo
- Resposta gerada por IA dentro do node (backlog, ver `docs/06-roadmap.md`)

## Rastreabilidade

Cada requisito acima é referenciado pelas etapas das Waves 1-4 em
[`docs/07-plano-waves-spec-driven.md`](docs/07-plano-waves-spec-driven.md).
Nenhuma etapa é considerada "VERIFY ok" sem apontar de volta pra pelo menos
um RF/RNF daqui.
