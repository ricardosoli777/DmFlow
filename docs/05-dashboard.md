# 05 — Dashboard

## Telas principais

### 1. Triggers (Automações de Comentário)
- Lista de posts/reels monitorados.
- Por trigger: post vinculado, palavra-chave (ou "qualquer comentário"),
  flow disparado, status (ativo/pausado), contador de disparos.
- Botão "Nova automação": colar link do post/reel → definir palavra-chave →
  escolher flow.

### 2. Editor de Fluxo
- Canvas visual (drag-and-drop) usando **React Flow**.
- Paleta lateral com os tipos de node (mensagem, botões, delay, condição,
  captura, tag, webhook, fim).
- Preview de como a mensagem aparece no DM (mock visual estilo Instagram).
- Salvar como versão (permite reverter).

### 3. Inbox
- Lista de conversas ativas, com contato, último evento, node atual do flow.
- Permite intervenção manual (assumir a conversa e responder direto, saindo
  do fluxo automático) — útil pra casos que fogem do script.

### 4. Contatos
- Lista de contatos capturados, tags, atributos custom, histórico de flows
  rodados.
- Filtro por tag/segmento.

### 5. Métricas
- Comentários capturados por trigger.
- DMs enviados / taxa de resposta.
- Funil de conclusão do flow (quantos chegaram em cada node → drop-off).

## Stack sugerida

- Next.js (React) + TypeScript
- React Flow (editor de grafo)
- TailwindCSS + shadcn/ui (componentes prontos, acelera bastante)
- TanStack Query pra consumo da API
