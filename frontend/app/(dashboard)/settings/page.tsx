"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";

// Ordem e conteúdo batem com o passo a passo de docs/04-integracao-meta.md —
// cada campo já abre direto a tela certa da Meta, em vez de só descrever.
const HELP = {
  appId: {
    steps: [
      "Acesse developers.facebook.com/apps e abra seu app (ou crie um do tipo Business)",
      "Menu lateral → Configurações do app → Básico",
      "O 'ID do aplicativo' aparece bem no topo da página",
    ],
    link: { label: "Abrir developers.facebook.com/apps", url: "https://developers.facebook.com/apps" },
  },
  appSecret: {
    steps: [
      "Mesma página do App ID (Configurações do app → Básico)",
      "Logo abaixo, campo 'Chave secreta do aplicativo'",
      "Clique em 'Mostrar' (pede sua senha do Facebook de novo)",
    ],
    link: { label: "Abrir developers.facebook.com/apps", url: "https://developers.facebook.com/apps" },
  },
  pageAccessToken: {
    steps: [
      "Dentro do app → Adicionar produto → Instagram → 'API setup with Instagram business login'",
      "Na etapa 'Generate access tokens', ache a linha da sua conta",
      "Clique em 'Gerar token' e copie o valor completo (começa com 'EAA')",
    ],
    link: { label: "Abrir developers.facebook.com/apps", url: "https://developers.facebook.com/apps" },
  },
  igUserId: {
    steps: [
      "Ferramentas → Graph API Explorer, com o token gerado no passo anterior",
      "Rode: GET /me/accounts?fields=instagram_business_account",
      "Na resposta, o campo instagram_business_account.id é o valor (é um número, não o @usuário)",
    ],
    link: {
      label: "Abrir Graph API Explorer",
      url: "https://developers.facebook.com/tools/explorer/",
    },
  },
  verifyToken: {
    steps: [
      "Não vem da Meta — você mesmo inventa (ex: uma senha aleatória)",
      "Use o mesmo valor aqui e ao configurar o Webhook no app",
      "Lá: produto Instagram → Webhooks → Editar assinatura → 'Verificar token'",
    ],
  },
};

// Validação de formato em tempo real — heurística (não é garantia da Meta
// aceitar), só evita erro bobo de colar a coisa errada no campo errado
// antes mesmo de testar a conexão.
const FORMAT_HINTS: Record<keyof FormState, { test: (v: string) => boolean; hint: string }> = {
  appId: { test: (v) => /^\d{8,20}$/.test(v), hint: "Deve ser só números (geralmente 15-16 dígitos)" },
  appSecret: { test: (v) => /^[a-f0-9]{32}$/i.test(v), hint: "Deve ter 32 caracteres em hexadecimal (0-9, a-f)" },
  pageAccessToken: { test: (v) => /^EAA[A-Za-z0-9]{20,}$/.test(v), hint: "Tokens da Meta começam com 'EAA' e são bem longos" },
  igUserId: { test: (v) => /^\d{8,25}$/.test(v), hint: "Deve ser só números — confirma que não colou o @usuário" },
  verifyToken: { test: (v) => v.trim().length >= 6, hint: "Escolha algo com pelo menos 6 caracteres" },
};

// Traduz os erros mais comuns da Graph API pra algo acionável — a mensagem
// crua da Meta ainda fica disponível expandindo "ver detalhe técnico".
function friendlyConnectionError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("invalid oauth access token") || lower.includes("error validating access token")) {
    return "O Page Access Token está inválido ou expirou — gere um novo (veja o ícone de ajuda do campo).";
  }
  if (lower.includes("unsupported get request") || lower.includes("does not exist")) {
    return "Esse IG User ID não foi encontrado — confirme que é o ID da conta Instagram Business, não da Página do Facebook nem o @usuário.";
  }
  if (lower.includes("permission")) {
    return "Esse token não tem permissão pra essa conta — confirme que você é admin/testador do app e que a conta Instagram está vinculada a ele.";
  }
  if (lower.includes("faltam credenciais")) {
    return "Preencha pelo menos o Page Access Token e o IG User ID pra testar a conexão.";
  }
  return "Não consegui conectar com essas credenciais.";
}

type InstagramAccountStatus = {
  id: string;
  connected: boolean;
  username?: string;
  error?: string;
  appId?: string;
  igUserId?: string;
  graphApiVersion?: string;
  hasAppSecret?: boolean;
  hasVerifyToken?: boolean;
  hasPageAccessToken?: boolean;
};

type FormState = {
  appId: string;
  appSecret: string;
  pageAccessToken: string;
  igUserId: string;
  verifyToken: string;
};

const emptyForm: FormState = { appId: "", appSecret: "", pageAccessToken: "", igUserId: "", verifyToken: "" };

// RF17 — um workspace pode ter várias contas Instagram conectadas; cada
// card abaixo é uma conta, com status real (chama a Graph API) + form pra
// trocar as credenciais sem precisar mexer no .env/redeploy.
export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["instagram-accounts"],
    queryFn: () => api.get<InstagramAccountStatus[]>("/instagram-accounts"),
  });

  const addAccount = useMutation({
    mutationFn: () => api.post<{ id: string }>("/instagram-accounts", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["instagram-accounts"] }),
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configurações</h1>
        <Button onClick={() => addAccount.mutate()} disabled={addAccount.isPending}>
          + Nova conta Instagram
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando contas conectadas...</p>}
      {!isLoading && !accounts?.length && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma conta Instagram conectada ainda — clique em &ldquo;Nova conta Instagram&rdquo; pra começar.
          </CardContent>
        </Card>
      )}

      {(accounts ?? []).map((account) => (
        <InstagramAccountCard key={account.id} account={account} />
      ))}
    </div>
  );
}

function InstagramAccountCard({ account }: { account: InstagramAccountStatus }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showTechnicalError, setShowTechnicalError] = useState(false);
  const zernio = useMutation({
    mutationFn: () => api.get<{ authUrl: string }>("/oauth/zernio/start"),
    onSuccess: ({ authUrl }) => { window.open(authUrl, "_blank", "noopener,noreferrer"); },
    onError: (err: unknown) => setSaveError(err instanceof Error ? err.message : "Não foi possível iniciar o Zernio."),
  });

  const oauth = useMutation({
    mutationFn: () => api.get<{ url: string }>(`/oauth/meta/start?accountId=${encodeURIComponent(account.id)}`),
    onSuccess: ({ url }) => { window.open(url, "_blank", "noopener,noreferrer"); },
    onError: (err: unknown) => setSaveError(err instanceof Error ? err.message : "Não foi possível iniciar o OAuth."),
  });

  const save = useMutation({
    mutationFn: (body: Partial<FormState>) => api.put<InstagramAccountStatus>(`/instagram-accounts/${account.id}`, body),
    onSuccess: () => {
      setSaveError(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["instagram-accounts"] });
    },
    onError: (err: unknown) => {
      setShowTechnicalError(false);
      setSaveError(err instanceof Error ? err.message : "Não foi possível salvar.");
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/instagram-accounts/${account.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["instagram-accounts"] }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const patch = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== ""));
    save.mutate(patch);
  }

  function handleDelete() {
    if (!window.confirm("Desconectar essa conta? Contatos e histórico ficam guardados, só a conexão some.")) return;
    remove.mutate();
  }

  function field(key: keyof FormState) {
    return form[key];
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{account.username ? `@${account.username}` : "Conta Instagram"}</CardTitle>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger"
          title="Desconectar conta"
        >
          <Trash2 size={16} />
        </button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {account.connected ? (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-success" size={20} />
            <div>
              <p className="text-sm font-medium">
                Conectado como <span className="text-primary">@{account.username}</span>
              </p>
              <p className="text-xs text-muted-foreground">IG User ID: {account.igUserId}</p>
            </div>
            <Badge variant="ativo" className="ml-auto">
              Conectado
            </Badge>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <XCircle className="text-danger" size={20} />
            <div>
              <p className="text-sm font-medium">Não conectado</p>
              {account.error && <p className="text-xs text-muted-foreground">{friendlyConnectionError(account.error)}</p>}
            </div>
            <Badge variant="erro" className="ml-auto">
              Desconectado
            </Badge>
          </div>
        )}

        <hr className="border-border" />

        <Button type="button" variant="secondary" onClick={() => oauth.mutate()} disabled={oauth.isPending}>
          {oauth.isPending ? "Abrindo Meta..." : "Conectar com Meta/Instagram (OAuth)"}
        </Button>

        <Button type="button" variant="secondary" onClick={() => zernio.mutate()} disabled={zernio.isPending}>
          {zernio.isPending ? "Abrindo Zernio..." : "Conectar via Zernio (alternativa)"}
        </Button>

        <p className="text-sm text-muted-foreground">
          Preencha os campos abaixo, na ordem, pra conectar (ou trocar) essa conta — cada um tem um botão que já
          abre a tela certa da Meta. Deixe em branco o que você não quer alterar. Guia completo em{" "}
          <a
            href="https://github.com/ricardosoli777/DmFlow/blob/main/docs/04-integracao-meta.md"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            docs/04-integracao-meta.md
          </a>
          .
        </p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            fieldKey="appId"
            label="1. App ID"
            help={HELP.appId}
            value={field("appId")}
            placeholder={account.appId || "ex: 1234567890123456"}
            onChange={(v) => setForm({ ...form, appId: v })}
          />
          <Field
            fieldKey="appSecret"
            label="2. App Secret"
            help={HELP.appSecret}
            value={field("appSecret")}
            placeholder={account.hasAppSecret ? "•••••••••• (já configurado)" : ""}
            onChange={(v) => setForm({ ...form, appSecret: v })}
            type="password"
          />
          <div className="sm:col-span-2">
            <Field
              fieldKey="pageAccessToken"
              label="3. Page Access Token"
              help={HELP.pageAccessToken}
              value={field("pageAccessToken")}
              placeholder={account.hasPageAccessToken ? "•••••••••• (já configurado)" : ""}
              onChange={(v) => setForm({ ...form, pageAccessToken: v })}
              type="password"
            />
          </div>
          <Field
            fieldKey="igUserId"
            label="4. IG User ID"
            help={HELP.igUserId}
            value={field("igUserId")}
            placeholder={account.igUserId || "ex: 17841400000000000"}
            onChange={(v) => setForm({ ...form, igUserId: v })}
          />
          <Field
            fieldKey="verifyToken"
            label="5. Verify Token"
            help={HELP.verifyToken}
            value={field("verifyToken")}
            placeholder={account.hasVerifyToken ? "•••••••••• (já configurado)" : ""}
            onChange={(v) => setForm({ ...form, verifyToken: v })}
          />

          {saveError && (
            <div className="text-sm text-danger sm:col-span-2">
              <p>{friendlyConnectionError(saveError)}</p>
              <button
                type="button"
                onClick={() => setShowTechnicalError((v) => !v)}
                className="mt-1 text-xs underline text-muted-foreground hover:text-foreground"
              >
                {showTechnicalError ? "ocultar detalhe técnico" : "ver detalhe técnico"}
              </button>
              {showTechnicalError && (
                <p className="mt-1 rounded bg-muted/50 p-2 font-mono text-xs text-muted-foreground">{saveError}</p>
              )}
            </div>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Testando conexão..." : "Salvar e testar conexão"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  fieldKey,
  label,
  help,
  value,
  placeholder,
  onChange,
  type = "text",
}: {
  fieldKey: keyof FormState;
  label: string;
  help?: { steps: string[]; link?: { label: string; url: string } };
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const trimmed = value.trim();
  const formatCheck = FORMAT_HINTS[fieldKey];
  const showHint = trimmed.length > 0 && !formatCheck.test(trimmed);

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex items-center gap-1.5">
        {label}
        {help && <InfoTooltip steps={help.steps} link={help.link} />}
      </span>
      <input
        type={type}
        className={`rounded-[var(--radius)] border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary ${
          showHint ? "border-warning" : "border-border"
        }`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {showHint && <span className="text-xs text-warning">{formatCheck.hint}</span>}
    </label>
  );
}
