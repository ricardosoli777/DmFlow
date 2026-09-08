import { getPrisma } from "@dmflow/db";
import { advanceFlowRun } from "./executor";

const prisma = getPrisma();

type CommentEvent = {
  kind: "comment";
  postId: string;
  commentId: string;
  fromIgsid: string;
  fromName?: string;
  text: string;
};

type MessageEvent = {
  kind: "message" | "postback";
  fromIgsid: string;
  text: string;
};

export type InstagramEvent = CommentEvent | MessageEvent;

// RF01, RF02 — decide qual trigger/flow_run corresponde a um evento cru.
export async function resolveEvent(event: InstagramEvent): Promise<void> {
  const contact = await prisma.contact.upsert({
    where: { igsid: event.fromIgsid },
    update: {},
    create: { igsid: event.fromIgsid, name: "fromName" in event ? event.fromName : undefined },
  });

  if (event.kind === "comment") {
    const trigger = await prisma.postTrigger.findFirst({
      where: {
        postId: event.postId,
        active: true,
        OR: [{ keyword: null }, { keyword: { equals: event.text, mode: "insensitive" } }],
      },
    });
    if (!trigger) return; // RF02: comentário sem match, ignora

    await prisma.postTrigger.update({ where: { id: trigger.id }, data: { hitCount: { increment: 1 } } });

    const flow = await prisma.flow.findUniqueOrThrow({ where: { id: trigger.flowId } });
    const definition = flow.definition as unknown as { start: string };

    const run = await prisma.flowRun.create({
      data: { contactId: contact.id, flowId: flow.id, currentNode: definition.start, status: "running" },
    });

    await advanceFlowRun(run.id);
    return;
  }

  // event.kind === "message" | "postback": avança um flow_run que estava "waiting"
  const run = await prisma.flowRun.findFirst({
    where: { contactId: contact.id, status: "waiting" },
    orderBy: { updatedAt: "desc" },
  });
  if (!run) return;

  await prisma.message.create({ data: { contactId: contact.id, direction: "inbound", content: event.text } });
  await advanceFlowRun(run.id);
}
