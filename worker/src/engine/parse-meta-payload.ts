import type { InstagramEvent } from "./resolve-event";

// Traduz o payload bruto do webhook da Meta (Instagram Graph API) pro shape
// interno do engine. Ver docs/04-integracao-meta.md pro formato oficial.
//
// "comments": entry[].changes[] com field "comments"
// "messages"/"postbacks": entry[].messaging[] (formato Messenger-like)
export function parseMetaPayload(payload: unknown): InstagramEvent[] {
  const events: InstagramEvent[] = [];
  const entries = (payload as any)?.entry ?? [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments") continue;
      const value = change.value;
      if (!value?.id || !value?.from?.id) continue;

      events.push({
        kind: "comment",
        postId: value.media?.id ?? value.parent_id ?? "",
        commentId: value.id,
        fromIgsid: value.from.id,
        fromName: value.from.username,
        text: value.text ?? "",
      });
    }

    for (const messaging of entry.messaging ?? []) {
      const fromIgsid = messaging.sender?.id;
      if (!fromIgsid) continue;

      if (messaging.postback) {
        events.push({ kind: "postback", fromIgsid, text: messaging.postback.payload ?? "" });
        continue;
      }

      // Clique em botão (quick reply) chega como "message" com quick_reply.payload —
      // tratamos igual a um postback (payload = id do node de destino).
      if (messaging.message?.quick_reply?.payload) {
        events.push({ kind: "postback", fromIgsid, text: messaging.message.quick_reply.payload });
        continue;
      }

      if (messaging.message?.text) {
        events.push({ kind: "message", fromIgsid, text: messaging.message.text });
      }
    }
  }

  return events;
}
