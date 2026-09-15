"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";

const HELP = {
  appId: [
    "Acesse developers.facebook.com/apps e abra seu app",
    "Menu lateral → Configurações do app → Básico",
    "O 'ID do aplicativo' aparece bem no topo da página",
  ],
  appSecret: [
    "Mesma página do App ID (Configurações do app → Básico)",
    "Logo abaixo, campo 'Chave secreta do aplicativo'",
    "Clique em 'Mostrar' (pede sua senha do Facebook de novo)",
  ],
  igUserId: [
    "Acesse business.facebook.com → Configurações do negócio",
    "Menu lateral → Contas → Contas do Instagram",
    "Clique na sua conta — o ID aparece nos detalhes dela",
  ],
  verifyToken: [
    "Não vem da Meta — você mesmo inventa (ex: uma senha aleatória)",
    "Use o mesmo valor aqui e ao configurar o Webhook no app",
    "Lá: produto Instagram → Webhooks → Editar assinatura → 'Verificar token'",
  ],
  pageAccessToken: [
    "Dentro do app → produto Instagram → 'API setup with Instagram business login'",
    "Na etapa 'Gerar tokens de acesso', ache a linha da sua conta",
    "Clique em 'Gerar token' e copie o valor completo",
  ],
};

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
  verifyToken: string;
  pageAccessToken: string;
  igUserId: string;
};

const emptyForm: FormState = { appId: "", appSecret: "", verifyToken: "", pageAccessToken: "", igUserId: "" };

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

  const save = useMutation({
    mutationFn: (body: Partial<FormState>) => api.put<InstagramAccountStatus>(`/instagram-accounts/${account.id}`, body),
    onSuccess: () => {
      setSaveError(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["instagram-accounts"] });
    },
    onError: (err: unknown) => setSaveError(err instanceof Error ? err.message : "Não foi possível salvar."),
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
              {account.error && <p className="text-xs text-muted-foreground">{account.error}</p>}
            </div>
            <Badge variant="erro" className="ml-auto">
              Desconectado
            </Badge>
          </div>
        )}

        <hr className="border-border" />

        <p className="text-sm text-muted-foreground">
          Preencha os campos abaixo pra conectar (ou trocar) essa conta. Deixe em branco o que você não quer
          alterar. Veja onde pegar cada valor em{" "}
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
            label="App ID"
            help={HELP.appId}
            value={form.appId}
            placeholder={account.appId || "ex: 1234567890123456"}
            onChange={(v) => setForm({ ...form, appId: v })}
          />
          <Field
            label="App Secret"
            help={HELP.appSecret}
            value={form.appSecret}
            placeholder={account.hasAppSecret ? "•••••••••• (já configurado)" : ""}
            onChange={(v) => setForm({ ...form, appSecret: v })}
            type="password"
          />
          <Field
            label="IG User ID"
            help={HELP.igUserId}
            value={form.igUserId}
            placeholder={account.igUserId || "ex: 17841400000000000"}
            onChange={(v) => setForm({ ...form, igUserId: v })}
          />
          <Field
            label="Verify Token"
            help={HELP.verifyToken}
            value={form.verifyToken}
            placeholder={account.hasVerifyToken ? "•••••••••• (já configurado)" : ""}
            onChange={(v) => setForm({ ...form, verifyToken: v })}
          />
          <div className="sm:col-span-2">
            <Field
              label="Page Access Token"
              help={HELP.pageAccessToken}
              value={form.pageAccessToken}
              placeholder={account.hasPageAccessToken ? "•••••••••• (já configurado)" : ""}
              onChange={(v) => setForm({ ...form, pageAccessToken: v })}
              type="password"
            />
          </div>

          {saveError && <p className="text-sm text-danger sm:col-span-2">{saveError}</p>}

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
  label,
  help,
  value,
  placeholder,
  onChange,
  type = "text",
}: {
  label: string;
  help?: string[];
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex items-center gap-1.5">
        {label}
        {help && <InfoTooltip steps={help} />}
      </span>
      <input
        type={type}
        className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
