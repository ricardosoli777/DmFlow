"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// RNF10 — sem senha: login é sempre por link de e-mail de uso único.
// `?invitation=token` (link de convite copiado por um owner/admin — ver
// /settings/team) já entra pré-preenchido pra aceitar o convite no clique.
function LoginForm() {
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invitation") ?? undefined;

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/magic-link", { email, invitationToken });
      setSent(true);
    } catch {
      setError("Não consegui enviar o link. Tente de novo em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Entrar no DMFlow</CardTitle>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm text-muted-foreground">
              Te mandamos um link de acesso pra <span className="font-medium text-foreground">{email}</span>.
              Abra seu e-mail e clique no link pra entrar (expira em 15 minutos).
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                required
              />
              {invitationToken && (
                <p className="text-xs text-muted-foreground">
                  Entrando via convite — use o mesmo e-mail que recebeu o convite.
                </p>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={loading}>
                {loading ? "Enviando..." : "Mandar link de acesso"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
