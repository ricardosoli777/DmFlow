"use client";

import { Info } from "lucide-react";
import { useState } from "react";

// Ícone "i" que abre um balão com passo a passo — usado nos campos de
// credenciais em /settings pra explicar onde pegar cada valor.
export function InfoTooltip({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="inline-flex text-muted-foreground hover:text-primary"
        aria-label="Como pegar esse valor"
      >
        <Info size={14} />
      </button>

      {open && (
        <div className="absolute left-1/2 top-6 z-10 w-64 -translate-x-1/2 rounded-[var(--radius)] border border-border bg-card p-3 text-xs font-normal normal-case text-foreground shadow-lg">
          <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-border bg-card" />
          <ol className="flex list-decimal flex-col gap-1 pl-4">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </span>
  );
}
