"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { api, setSession, type WorkspaceMembership } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// RNF10 — segunda perna do login por magic-link: o link do e-mail cai aqui
// com `?token=...` (e `&invitation=...` se veio de um convite), troca por um
// JWT de verdade e entra direto — sem senha nenhuma envolvida.
function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const retryPath = searchParams.get("flow") === "register" ? "/register" : "/login";
  const invitationForRetry = searchParams.get("invitation");
  const retryUrl = invitationForRetry ? `${retryPath}?invitation=${encodeURIComponent(invitationForRetry)}` : retryPath;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const invitation = searchParams.get("invitation");
    const flow = searchParams.get("flow") === "register" ? "register" : "login";
    if (!token) {
      setError("Link inválido.");
      return;
    }

    const params = new URLSearchParams({ token, flow });
    if (invitation) params.set("invitation", invitation);
    api
      .get<{ token: string; workspaces: WorkspaceMembership[] }>(`/auth/magic-link/verify?${params}`)
      .then((res) => {
        setSession(res.token, res.workspaces);
        router.push("/");
      })
      .catch(() => setError("Esse link expirou ou já foi usado — peça um novo link."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Entrando...</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="space-y-3 text-sm">
              <p className="text-danger">{error}</p>
              <Link className="text-primary underline" href={retryUrl}>
                Solicitar outro link
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Confirmando seu login, um instante...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}
