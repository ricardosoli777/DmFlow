// Envio real via Instagram Messaging API — implementação completa na Wave 2
// (ver docs/07-plano-waves-spec-driven.md, docs/04-integracao-meta.md).
import { env } from "../env";

export async function sendDirectMessage(igsid: string, text: string): Promise<void> {
  if (!env.META_PAGE_ACCESS_TOKEN) {
    console.log(`[stub] enviaria DM pra ${igsid}: "${text}"`);
    return;
  }

  // TODO (Wave 2): POST /{ig-user-id}/messages com recipient.id = igsid
  console.log(`[TODO Wave 2] enviar DM real pra ${igsid}: "${text}"`);
}

export async function sendPrivateReply(commentId: string, text: string): Promise<void> {
  // TODO (Wave 2): POST /{comment_id}/private_replies
  console.log(`[TODO Wave 2] private reply pro comentário ${commentId}: "${text}"`);
}
