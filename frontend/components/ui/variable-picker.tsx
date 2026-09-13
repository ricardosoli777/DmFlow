"use client";

// Botões pra inserir `{{variavel}}` no ponto do cursor de um input/textarea,
// em vez de exigir que a pessoa digite a sintaxe de cor (igual ManyChat).
export type Variable = { key: string; label: string };

export const BUILTIN_VARIABLES: Variable[] = [
  { key: "name", label: "Nome" },
  { key: "first_name", label: "Primeiro nome" },
  { key: "username", label: "@usuário" },
  { key: "tags", label: "Tags" },
];

export function VariablePicker({
  variables,
  fieldRef,
  value,
  onChange,
}: {
  variables: Variable[];
  fieldRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement>;
  value: string;
  onChange: (next: string) => void;
}) {
  function insert(key: string) {
    const token = `{{${key}}}`;
    const el = fieldRef.current;

    if (!el) {
      onChange(value + token);
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="flex flex-wrap gap-1">
      {variables.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => insert(v.key)}
          title={`Inserir {{${v.key}}}`}
          className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
