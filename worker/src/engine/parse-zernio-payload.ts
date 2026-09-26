import type { InstagramEvent } from "./resolve-event";

export type ZernioInbound = {
  id: string;
  event: "message.received";
  account: { accountId?: string; id?: string; platform: string };
  conversation: { id: string; participantId?: string };
  message: {
    platform: string;
    direction: string;
    text?: string | null;
    sender: { id: string; name?: string; username?: string; picture?: string };
  };
  metadata?: { quickReplyPayload?: string; postbackPayload?: string } | null;
};

export function parseZernioPayload(payload: unknown): { accountId: string; conversationId: string; event: InstagramEvent; sender: ZernioInbound["message"]["sender"] } | null {
  const data = payload as Partial<ZernioInbound>;
  if (data.event !== "message.received" || data.account?.platform !== "instagram" ||
      data.message?.platform !== "instagram" || data.message.direction !== "incoming") return null;
  const accountId = data.account.accountId ?? data.account.id;
  const sender = data.message.sender;
  const conversationId = data.conversation?.id;
  if (!accountId || !sender?.id || !conversationId) return null;
  const clicked = data.metadata?.quickReplyPayload ?? data.metadata?.postbackPayload;
  if (!clicked && !data.message.text) return null;
  return {
    accountId,
    conversationId,
    sender,
    event: clicked
      ? { kind: "postback", fromIgsid: sender.id, text: clicked }
      : { kind: "message", fromIgsid: sender.id, text: data.message.text! },
  };
}

export function parseZernioComment(payload: unknown): { accountId: string; event: InstagramEvent; author: { id: string; name?: string; username?: string; picture?: string | null } } | null {
  const data = payload as {
    event?: string;
    account?: { accountId?: string; id?: string; platform?: string };
    comment?: { id?: string; platform?: string; platformPostId?: string; text?: string; author?: { id: string; name?: string; username?: string; picture?: string | null; isOwnAccount?: boolean } };
  };
  if (data.event !== "comment.received" || data.account?.platform !== "instagram" ||
      data.comment?.platform !== "instagram" || data.comment.author?.isOwnAccount) return null;
  const accountId = data.account.accountId ?? data.account.id;
  const comment = data.comment;
  if (!accountId || !comment.id || !comment.platformPostId || !comment.author?.id) return null;
  return {
    accountId,
    author: comment.author,
    event: { kind: "comment", postId: comment.platformPostId, commentId: comment.id,
      fromIgsid: comment.author.id, fromName: comment.author.name ?? comment.author.username, text: comment.text ?? "" },
  };
}
