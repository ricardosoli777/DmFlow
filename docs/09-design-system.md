# 09 — Design System (DMFlow UI Kit)

Base visual do dashboard. Objetivo: aparência premium de produto SaaS
(estilo Linear/Vercel/ManyChat novo), consistente em light e dark,
implementada com Tailwind + componentes reutilizáveis (padrão shadcn/ui).

## Princípios

1. **Dark-first, mas nativo em ambos os temas** — a maioria dos usuários de
   dashboards de automação usa dark mode; light mode é primeira classe, não
   um ajuste em cima.
2. **Densidade alta, ruído baixo** — muita informação (fluxos, contatos,
   métricas) cabendo na tela sem virar bagunça. Bordas finas, sombras
   discretas, cor usada com intenção (status, ação primária).
3. **Uma cor de destaque só** — evita dashboard "arco-íris". Cor de marca
   usada em botões primários, links ativos, indicadores de status "ativo".
4. **Tipografia funcional** — Inter (ou system-ui) em todo lugar; hierarquia
   por peso e tamanho, não por fonte diferente.

## Tokens de cor

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --border: 240 5.9% 90%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;

  --primary: 262 83% 58%;        /* roxo/indigo — cor de marca DMFlow */
  --primary-foreground: 0 0% 100%;

  --success: 142 71% 45%;
  --warning: 38 92% 50%;
  --danger: 0 84% 60%;

  --radius: 0.75rem;
}

.dark {
  --background: 240 10% 5%;
  --foreground: 0 0% 98%;
  --card: 240 8% 8%;
  --card-foreground: 0 0% 98%;
  --border: 240 6% 16%;
  --muted: 240 6% 12%;
  --muted-foreground: 240 5% 64.9%;

  --primary: 263 85% 66%;
  --primary-foreground: 240 10% 5%;

  --success: 142 65% 50%;
  --warning: 38 92% 55%;
  --danger: 0 72% 60%;
}
```

## Tipografia

| Uso | Fonte | Peso | Tamanho |
|---|---|---|---|
| Título de página | Inter | 700 | 24px |
| Título de card | Inter | 600 | 16px |
| Corpo | Inter | 400 | 14px |
| Legenda/meta | Inter | 500 | 12px |

## Espaçamento

Escala base 4px (Tailwind padrão): `2, 4, 8, 12, 16, 24, 32, 48`.
Cards usam padding `24px` (`p-6`); espaço entre seções `32px` (`gap-8`).

## Componentes-base (`frontend/components/ui/`)

- `button.tsx` — variantes `primary`, `secondary`, `ghost`, `destructive`;
  tamanhos `sm`, `md`, `lg`.
- `card.tsx` — container com borda 1px, `radius` do token, sombra sutil.
- `badge.tsx` — status: `ativo` (success), `pausado` (warning), `erro`
  (danger), `rascunho` (muted).
- `input.tsx` / `textarea.tsx` — borda fina, foco com anel na cor primária.
- `sidebar-nav.tsx` — navegação lateral fixa do dashboard.
- `data-table.tsx` — tabela densa (contatos, triggers) com paginação.
- `stat-card.tsx` — cartão de métrica (número grande + label + delta).

## Layout do Dashboard

```
┌───────────┬──────────────────────────────────────────┐
│           │  Topbar (título da página + ações)        │
│  Sidebar  ├──────────────────────────────────────────┤
│  (nav)    │                                            │
│           │  Conteúdo (grid de cards / tabela / canvas)│
│           │                                            │
└───────────┴──────────────────────────────────────────┘
```

Sidebar: Visão Geral, Triggers, Fluxos, Inbox, Contatos, Configurações.

## Implementação

- Tailwind com os tokens acima em `frontend/tailwind.config.ts`.
- Componentes em `frontend/components/ui/*` seguindo o padrão
  [shadcn/ui](https://ui.shadcn.com) (composáveis, sem lib de UI pesada
  acoplada — só Radix primitives + Tailwind).
- Ícones: `lucide-react`.
