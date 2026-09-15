import nodemailer from "nodemailer";
import { env } from "../env";

let gmailTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getGmailTransport() {
  if (!gmailTransport) {
    gmailTransport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
    });
  }
  return gmailTransport;
}

/**
 * RNF10/RNF06 — três caminhos, nessa ordem (ver README.md "Login por
 * e-mail"): Resend (recomendado) → Gmail com senha de app (sem domínio,
 * mais simples de começar) → console.log (dev/local, sem nenhum
 * configurado) — mesmo padrão de fallback já usado pra Graph API sem token
 * (ver worker/src/services/instagram.ts).
 */
export async function sendTransactionalEmail(to: string, subject: string, html: string): Promise<void> {
  if (env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Falha ao enviar e-mail via Resend (${res.status}): ${body}`);
    }
    return;
  }

  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    await getGmailTransport().sendMail({
      from: env.EMAIL_FROM || env.GMAIL_USER,
      to,
      subject,
      html,
    });
    return;
  }

  console.log(`[dev sem RESEND_API_KEY/GMAIL_APP_PASSWORD] e-mail pra ${to} — ${subject}\n${html}`);
}

export function magicLinkEmailHtml(verifyUrl: string): string {
  return `<p>Clique no link abaixo pra entrar no DMFlow:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>Expira em 15 minutos. Se você não pediu esse link, pode ignorar este e-mail.</p>`;
}
