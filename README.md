# DMFlow

Automação de DM do Instagram estilo ManyChat — para uso próprio.

## O que é

Quando alguém comenta em um post/reel (ex: "comenta AQUI que eu te mando no DM"),
o DMFlow detecta o comentário, dispara uma mensagem privada automática e conduz
o usuário por um fluxo de conversa configurável (mensagens, botões, condições,
delays) até o fim do funil — tudo controlado por um dashboard visual.

## Documentação

- [01 — Visão Geral do Produto](docs/01-visao-geral.md)
- [02 — Arquitetura Técnica](docs/02-arquitetura.md)
- [03 — Motor de Fluxos (Flow Engine)](docs/03-motor-de-fluxos.md)
- [04 — Integração com Meta/Instagram](docs/04-integracao-meta.md)
- [05 — Dashboard](docs/05-dashboard.md)
- [06 — Roadmap de Construção (visão simples)](docs/06-roadmap.md)
- [07 — Plano de Execução em Waves (Spec-Driven)](docs/07-plano-waves-spec-driven.md)
- [08 — Reprodutibilidade via GitHub + Docker](docs/08-reprodutibilidade-docker-github.md)

## Repositório

https://github.com/ricardosoli777/DmFlow

## Infraestrutura

Projetado para rodar na VPS já existente (`arkitekt.space`, Docker Swarm),
reaproveitando Postgres (pgvector), MinIO, Redis e Traefik.
