import { env } from "../env";

// RNF10/RNF06 — sem RESEND_API_KEY configurado (uso local/dev), o e-mail só
// é impresso no console em vez de falhar — mesmo padrão de fallback já usado
// pra Graph API sem token (ver worker/src/services/instagram.ts).
export async function sendTransactionalEmail(to: string, subject: string, html: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[dev sem RESEND_API_KEY] e-mail pra ${to} — ${subject}\n${html}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao enviar e-mail via Resend (${res.status}): ${body}`);
  }
}

export function magicLinkEmailHtml(verifyUrl: string): string {
  return `<p>Clique no link abaixo pra entrar no DMFlow:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>Expira em 15 minutos. Se você não pediu esse link, pode ignorar este e-mail.</p>`;
}
