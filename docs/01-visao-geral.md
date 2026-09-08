# 01 — Visão Geral do Produto

## O problema que resolve

Você posta um reel/post e pede: "comenta X que eu te mando no DM".
Manualmente isso é inviável em escala — o DMFlow automatiza:

1. **Gatilho (trigger):** alguém comenta uma palavra-chave (ou qualquer
   comentário) em um post/reel específico.
2. **Resposta automática de DM:** o sistema envia uma mensagem privada
   inicial pro usuário que comentou.
3. **Fluxo conversacional:** a partir daí, o usuário interage dentro do DM
   (clica em botões, responde texto, recebe conteúdo, é segmentado/tageado)
   até completar o funil (ex: captar lead, entregar material, vender algo,
   agendar).

## Analogia direta com ManyChat

| Conceito ManyChat | Conceito DMFlow |
|---|---|
| Growth Tool "Comment Growth Tool" | Trigger de comentário vinculado a um post |
| Flow Builder | Editor visual de fluxo (nodes) |
| Automação/Sequência | Flow (grafo de nodes conectados) |
| Tags/Custom Fields | Tags e atributos do contato |
| Live Chat | Inbox de conversas em tempo real |
| Broadcast | Disparo em massa pra uma lista/segmento |

## Escopo v1 (uso próprio, não multi-tenant)

- 1 conta Instagram Business conectada (a sua)
- Trigger por comentário em post específico + palavra-chave opcional
- Envio de resposta pública automática no comentário (opcional, "comentei ✅")
- Envio de DM privado inicial
- Fluxo com: mensagem de texto, mensagem com botões (quick replies), delay,
  condição simples (se clicou X vai pra Y), captura de dado (nome/telefone/email),
  tag de contato, webhook de saída (integrar com CRM externo)
- Dashboard: criar/editar fluxos, listar triggers ativos, ver conversas,
  métricas básicas (comentários capturados, DMs enviados, taxa de conclusão do funil)

## Fora do escopo v1 (backlog)

- Multi-conta / multi-usuário (SaaS)
- IA generativa dentro do fluxo (respostas dinâmicas por LLM) — pode vir depois
  usando a infra pgvector já existente
- Broadcast em massa
- A/B testing de fluxo
