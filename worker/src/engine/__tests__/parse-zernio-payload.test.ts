import { describe, expect, it } from "vitest";
import { parseZernioComment, parseZernioPayload } from "../parse-zernio-payload";

const base = {
  id: "event-1",
  event: "message.received",
  account: { accountId: "account-rica", platform: "instagram" },
  conversation: { id: "conversation-1" },
  message: { platform: "instagram", direction: "incoming", text: "oi", sender: { id: "igsid-1", name: "Cliente" } },
};

describe("parseZernioPayload", () => {
  it("preserva conta, conversa e remetente da DM", () => {
    expect(parseZernioPayload(base)).toEqual({
      accountId: "account-rica", conversationId: "conversation-1",
      sender: { id: "igsid-1", name: "Cliente" },
      event: { kind: "message", fromIgsid: "igsid-1", text: "oi" },
    });
  });

  it("usa payload do botão em vez do texto visível", () => {
    expect(parseZernioPayload({ ...base, metadata: { quickReplyPayload: "node-2" } })?.event)
      .toEqual({ kind: "postback", fromIgsid: "igsid-1", text: "node-2" });
  });

  it("ignora mensagens de saída e de outra plataforma", () => {
    expect(parseZernioPayload({ ...base, message: { ...base.message, direction: "outgoing" } })).toBeNull();
    expect(parseZernioPayload({ ...base, account: { accountId: "other", platform: "facebook" } })).toBeNull();
  });
});

describe("parseZernioComment", () => {
  it("usa o ID nativo do post para localizar o trigger", () => {
    expect(parseZernioComment({
      event: "comment.received", account: { accountId: "account-rica", platform: "instagram" },
      comment: { id: "comment-1", postId: null, platformPostId: "post-native-1", platform: "instagram", text: "quero", author: { id: "igsid-1", username: "cliente" } },
    })).toEqual({
      accountId: "account-rica", author: { id: "igsid-1", username: "cliente" },
      event: { kind: "comment", postId: "post-native-1", commentId: "comment-1", fromIgsid: "igsid-1", fromName: "cliente", text: "quero" },
    });
  });

  it("ignora comentário da própria conta", () => {
    expect(parseZernioComment({
      event: "comment.received", account: { accountId: "account-rica", platform: "instagram" },
      comment: { id: "comment-1", platformPostId: "post-1", platform: "instagram", author: { id: "owner", isOwnAccount: true } },
    })).toBeNull();
  });
});
