"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, setSession, type WorkspaceMembership } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// RNF10 — segunda perna do login por magic-link: o link do e-mail cai aqui
// com `?token=...` (e `&invitation=...` se veio de um convite), troca por um
// JWT de verdade e entra direto — sem senha nenhuma envolvida.
function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const invitation = searchParams.get("invitation");
    if (!token) {
      setError("Link inválido.");
      return;
    }

    const query = invitation ? `?token=${token}&invitation=${invitation}` : `?token=${token}`;
    api
      .get<{ token: string; workspaces: WorkspaceMembership[] }>(`/auth/magic-link/verify${query}`)
      .then((res) => {
        setSession(res.token, res.workspaces);
        router.push("/");
      })
      .catch(() => setError("Esse link expirou ou já foi usado — peça um novo login."));
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
            <p className="text-sm text-danger">{error}</p>
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
