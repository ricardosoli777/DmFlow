"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function RegisterForm() {
  const invitationToken = useSearchParams().get("invitation") ?? undefined;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<{ status: "sent" | "already_registered" }>("/auth/register", { email, invitationToken });
      if (result.status === "already_registered") {
        setError("Este e-mail já tem cadastro. Entre com seu link de acesso.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Não consegui enviar o link. Tente de novo em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Criar conta no DMFlow</CardTitle></CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm text-muted-foreground">
              Enviamos um link de confirmação para <span className="font-medium text-foreground">{email}</span>.
              Abra seu e-mail e clique no link para concluir o cadastro (expira em 15 minutos).
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
              {invitationToken && <p className="text-xs text-muted-foreground">Use o mesmo e-mail que recebeu o convite.</p>}
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={loading}>{loading ? "Enviando..." : "Criar conta"}</Button>
              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{" "}
                <Link className="text-primary underline" href={invitationToken ? `/login?invitation=${encodeURIComponent(invitationToken)}` : "/login"}>
                  Entrar
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={null}><RegisterForm /></Suspense>;
}
