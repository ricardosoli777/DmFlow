# Contribuindo com o DMFlow

Projeto de uso pessoal, mas o repositório é público e reproduzível — então
mantém estas regras pra qualquer contribuição (própria ou de terceiros):

## Fluxo de trabalho

1. Toda mudança de código segue o método **spec-driven** descrito em
   [`docs/07-plano-waves-spec-driven.md`](docs/07-plano-waves-spec-driven.md):
   SPEC → PLAN → EXECUTE → VERIFY.
2. Commits atômicos, mensagem no imperativo, em português ou inglês
   consistente por PR.
3. Nunca commitar `.env`, tokens, senhas ou qualquer credencial — use
   `.env.example` como referência do que precisa existir.
4. Toda etapa nova de uma wave só é considerada pronta com o critério de
   aceite do plano satisfeito (não só "compilou").

## Estrutura do monorepo

```
backend/   → API + webhook receiver (Node.js)
worker/    → Flow engine (consumidor da fila)
frontend/  → Dashboard (Next.js)
infra/     → docker-compose, configs de deploy
docs/      → toda a documentação de produto/arquitetura/plano
```

## Rodando localmente

Ver [`docs/08-reprodutibilidade-docker-github.md`](docs/08-reprodutibilidade-docker-github.md).
