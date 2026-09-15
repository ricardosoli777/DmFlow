import { describe, expect, it } from "vitest";
import { flowDefinitionSchema } from "../flows";

describe("flowDefinitionSchema — RF21", () => {
  it("aceita um fluxo finito com referências válidas", () => {
    const result = flowDefinitionSchema.safeParse({
      start: "welcome",
      nodes: [
        { id: "welcome", type: "message", next: "finish" },
        { id: "finish", type: "end" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejeita início inexistente e destino quebrado", () => {
    const result = flowDefinitionSchema.safeParse({
      start: "missing",
      nodes: [{ id: "welcome", type: "message", next: "also-missing" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain("O node inicial não existe");
      expect(result.error.issues.map((issue) => issue.message)).toContain("Node aponta para destino inexistente: also-missing");
    }
  });

  it("rejeita IDs duplicados e ciclos", () => {
    const duplicate = flowDefinitionSchema.safeParse({
      start: "a",
      nodes: [{ id: "a", type: "message" }, { id: "a", type: "end" }],
    });
    expect(duplicate.success).toBe(false);

    const cycle = flowDefinitionSchema.safeParse({
      start: "a",
      nodes: [
        { id: "a", type: "message", next: "b" },
        { id: "b", type: "message", next: "a" },
      ],
    });
    expect(cycle.success).toBe(false);
    if (!cycle.success) expect(cycle.error.issues.map((issue) => issue.message)).toContain("O fluxo contém um ciclo");
  });
});
