import { describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));

import { requireRole } from "../auth";

describe("requireRole — RF19", () => {
  it("bloqueia MEMBER em uma mutação administrativa", async () => {
    const send = vi.fn();
    await requireRole("OWNER", "ADMIN")(
      { role: "MEMBER" } as any,
      { status: vi.fn(() => ({ send })) } as any,
    );
    expect(send).toHaveBeenCalledWith({ error: "Sem permissão pra essa ação" });
  });

  it("aceita ADMIN", async () => {
    const send = vi.fn();
    await requireRole("OWNER", "ADMIN")(
      { role: "ADMIN" } as any,
      { status: vi.fn(() => ({ send })) } as any,
    );
    expect(send).not.toHaveBeenCalled();
  });
});
