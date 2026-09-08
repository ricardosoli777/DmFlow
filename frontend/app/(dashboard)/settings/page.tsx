"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type InstagramStatus = {
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

// RF: área de conexão com a conta Instagram — status real (chama a Graph
// API) + formulário pra trocar de conta sem precisar mexer no .env/redeploy.
export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["instagram-status"],
    queryFn: () => api.get<InstagramStatus>("/settings/instagram"),
  });

  const save = useMutation({
    mutationFn: (body: Partial<FormState>) => api.put<InstagramStatus>("/settings/instagram", body),
    onSuccess: () => {
      setSaveError(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["instagram-status"] });
    },
    onError: (err: unknown) => {
      setSaveError(err instanceof Error ? err.message : "Não foi possível salvar.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // só envia os campos que a pessoa realmente preencheu — não sobrescreve
    // credenciais existentes com campo vazio
    const patch = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== ""));
    save.mutate(patch);
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle>Conexão com o Instagram</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Verificando conexão...</p>
          ) : status?.connected ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-success" size={20} />
              <div>
                <p className="text-sm font-medium">
                  Conectado como <span className="text-primary">@{status.username}</span>
                </p>
                <p className="text-xs text-muted-foreground">IG User ID: {status.igUserId}</p>
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
                {status?.error && <p className="text-xs text-muted-foreground">{status.error}</p>}
              </div>
              <Badge variant="erro" className="ml-auto">
                Desconectado
              </Badge>
            </div>
          )}

          <hr className="border-border" />

          <p className="text-sm text-muted-foreground">
            Preencha os campos abaixo pra conectar (ou trocar de) uma conta Instagram. Deixe em branco o
            que você não quer alterar. Veja onde pegar cada valor em{" "}
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
              value={form.appId}
              placeholder={status?.appId || "2799929817056395"}
              onChange={(v) => setForm({ ...form, appId: v })}
            />
            <Field
              label="App Secret"
              value={form.appSecret}
              placeholder={status?.hasAppSecret ? "•••••••••• (já configurado)" : ""}
              onChange={(v) => setForm({ ...form, appSecret: v })}
              type="password"
            />
            <Field
              label="IG User ID"
              value={form.igUserId}
              placeholder={status?.igUserId || "28082152674809917"}
              onChange={(v) => setForm({ ...form, igUserId: v })}
            />
            <Field
              label="Verify Token"
              value={form.verifyToken}
              placeholder={status?.hasVerifyToken ? "•••••••••• (já configurado)" : ""}
              onChange={(v) => setForm({ ...form, verifyToken: v })}
            />
            <div className="sm:col-span-2">
              <Field
                label="Page Access Token"
                value={form.pageAccessToken}
                placeholder={status?.hasPageAccessToken ? "•••••••••• (já configurado)" : ""}
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
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
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
