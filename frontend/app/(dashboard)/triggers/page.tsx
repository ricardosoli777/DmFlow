"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FlaskConical, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BUILTIN_VARIABLES, VariablePicker } from "@/components/ui/variable-picker";

type TriggerType = "comment" | "dm_keyword";

type Trigger = {
  id: string;
  type: TriggerType;
  postId: string | null;
  keyword: string | null;
  publicReplyText: string | null;
  active: boolean;
  hitCount: number;
  flow: { name: string };
};

type TriggerDetail = Trigger & {
  flowRuns: {
    id: string;
    status: string;
    createdAt: string;
    contact: { name: string | null; username: string | null; igsid: string };
  }[];
};

type Flow = { id: string; name: string };

type IgMedia = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
};

export default function TriggersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<TriggerType>("comment");
  const [postId, setPostId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [publicReplyText, setPublicReplyText] = useState("");
  const publicReplyRef = useRef<HTMLInputElement>(null);
  const [flowId, setFlowId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: triggers } = useQuery({
    queryKey: ["triggers"],
    queryFn: () => api.get<Trigger[]>("/triggers"),
  });

  const [editingKeywordId, setEditingKeywordId] = useState<string | null>(null);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; message: string } | null>(null);

  const updateTrigger = useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string;
      active?: boolean;
      keyword?: string | null;
      publicReplyText?: string | null;
      flowId?: string;
    }) =>
      api.patch(`/triggers/${id}`, patch),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
    },
    onError: (err: unknown) => setActionError(err instanceof Error ? err.message : "Não foi possível atualizar."),
  });

  const deleteTrigger = useMutation({
    mutationFn: (id: string) => api.delete(`/triggers/${id}`),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
    },
    onError: (err: unknown) => setActionError(err instanceof Error ? err.message : "Não foi possível excluir."),
  });

  const testTrigger = useMutation({
    mutationFn: (id: string) => api.post<{ testContactIgsid: string }>(`/triggers/${id}/test`, {}),
    onSuccess: (res, id) => {
      setTestResult({
        id,
        message: `Evento de teste enviado (contato ${res.testContactIgsid}). Acompanhe em Contatos/Inbox em alguns segundos.`,
      });
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
    },
    onError: (err: unknown) =>
      setTestResult({ id: "", message: err instanceof Error ? err.message : "Falha ao disparar teste." }),
  });

  function startEditingKeyword(t: Trigger) {
    setEditingKeywordId(t.id);
    setKeywordDraft(t.keyword ?? "");
  }

  function saveKeyword(id: string) {
    updateTrigger.mutate({ id, keyword: keywordDraft.trim() || null });
    setEditingKeywordId(null);
  }

  function handleDeleteTrigger(t: Trigger) {
    const label = t.type === "comment" ? `post ${t.postId}` : `DM "${t.keyword}"`;
    if (!window.confirm(`Excluir esta automação (${label})? Essa ação não pode ser desfeita.`)) return;
    deleteTrigger.mutate(t.id);
  }

  const { data: flows } = useQuery({
    queryKey: ["flows"],
    queryFn: () => api.get<Flow[]>("/flows"),
  });

  // RF: busca os posts/reels reais da conta conectada — atualiza sempre que
  // a aba de criação abre, pra sempre puxar o conteúdo mais recente.
  const {
    data: mediaData,
    isLoading: loadingMedia,
    error: mediaError,
    refetch: refetchMedia,
    isFetching: refreshingMedia,
  } = useQuery({
    queryKey: ["instagram-media"],
    queryFn: () => api.get<{ media: IgMedia[] }>("/instagram/media"),
    enabled: showForm && type === "comment",
  });

  const create = useMutation({
    mutationFn: () =>
      api.post("/triggers", {
        type,
        postId: type === "comment" ? postId : undefined,
        keyword: keyword.trim() || undefined,
        publicReplyText: type === "comment" ? publicReplyText.trim() || undefined : undefined,
        flowId,
      }),
    onSuccess: () => {
      setShowForm(false);
      setPostId("");
      setKeyword("");
      setPublicReplyText("");
      setFlowId("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Erro ao criar"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!flowId) {
      setError("Escolha um fluxo.");
      return;
    }
    if (type === "comment" && !postId.trim()) {
      setError("Escolha um post/reel.");
      return;
    }
    if (type === "dm_keyword" && !keyword.trim()) {
      setError("Informe a palavra-chave que a pessoa vai mandar por DM.");
      return;
    }
    create.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Triggers</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "Nova automação"}</Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("comment")}
                className={`rounded-[var(--radius)] border px-3 py-1.5 text-sm ${
                  type === "comment" ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
              >
                Comentário em post/reel
              </button>
              <button
                type="button"
                onClick={() => setType("dm_keyword")}
                className={`rounded-[var(--radius)] border px-3 py-1.5 text-sm ${
                  type === "dm_keyword" ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
              >
                DM com palavra-chave
              </button>
            </div>

            {type === "comment" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Escolha o post/reel</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchMedia()}
                    disabled={refreshingMedia}
                  >
                    <RefreshCw size={14} className={refreshingMedia ? "animate-spin" : ""} />
                    Atualizar
                  </Button>
                </div>

                {loadingMedia && <p className="text-sm text-muted-foreground">Buscando posts e reels...</p>}

                {mediaError && (
                  <p className="text-sm text-danger">
                    {mediaError instanceof Error ? mediaError.message : "Erro ao buscar posts"} — verifique a
                    conexão em Configurações.
                  </p>
                )}

                {!loadingMedia && !mediaError && (mediaData?.media?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum post/reel encontrado na conta conectada.</p>
                )}

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {(mediaData?.media ?? []).map((m) => {
                    const thumb = m.thumbnail_url || m.media_url;
                    const selected = postId === m.id;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setPostId(m.id)}
                        title={m.caption}
                        className={`group relative aspect-square overflow-hidden rounded-[var(--radius)] border-2 ${
                          selected ? "border-primary" : "border-transparent"
                        }`}
                      >
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt={m.caption ?? ""} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                            sem preview
                          </div>
                        )}
                        {m.media_type === "VIDEO" && (
                          <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
                            Reel
                          </span>
                        )}
                        {selected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-primary/30">
                            <Badge variant="ativo">Selecionado</Badge>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="flex flex-col gap-1 text-sm">
              {type === "comment"
                ? "Palavra-chave (deixe em branco pra disparar em qualquer comentário; se preencher, dispara quando o comentário CONTIVER essa palavra)"
                : "Palavra-chave (obrigatória — dispara quando a DM CONTIVER essa palavra, não precisa ser a mensagem inteira)"}
              <input
                className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="ex: quero, eu, link"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </label>

            {type === "comment" && (
              <label className="flex flex-col gap-1 text-sm">
                Resposta pública no comentário (opcional — some antes da DM, tipo prova social)
                <input
                  ref={publicReplyRef}
                  className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  placeholder="ex: {{name}}, te chamei no DM! 📩"
                  value={publicReplyText}
                  onChange={(e) => setPublicReplyText(e.target.value)}
                />
                <VariablePicker
                  variables={BUILTIN_VARIABLES}
                  fieldRef={publicReplyRef}
                  value={publicReplyText}
                  onChange={setPublicReplyText}
                />
              </label>
            )}

            <label className="flex flex-col gap-1 text-sm">
              Fluxo a disparar
              <select
                className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                value={flowId}
                onChange={(e) => setFlowId(e.target.value)}
              >
                <option value="">Escolha um fluxo...</option>
                {(flows ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              {!flows?.length && (
                <span className="text-xs text-muted-foreground">
                  Nenhum fluxo criado ainda — crie um em &ldquo;Fluxos&rdquo; primeiro.
                </span>
              )}
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" disabled={create.isPending} className="w-fit">
              {create.isPending ? "Criando..." : "Criar automação"}
            </Button>
          </form>
        </Card>
      )}

      {actionError && <p className="text-sm text-danger">{actionError}</p>}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="p-4 font-medium" />
              <th className="p-4 font-medium">Tipo</th>
              <th className="p-4 font-medium">Post / Palavra-chave</th>
              <th className="p-4 font-medium">Fluxo</th>
              <th className="p-4 font-medium">Disparos</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(triggers ?? []).map((t) => (
              <TriggerRow
                key={t.id}
                trigger={t}
                flows={flows ?? []}
                expanded={expandedId === t.id}
                onToggleExpand={() => setExpandedId(expandedId === t.id ? null : t.id)}
                editingKeyword={editingKeywordId === t.id}
                keywordDraft={keywordDraft}
                onStartEditKeyword={() => startEditingKeyword(t)}
                onKeywordDraftChange={setKeywordDraft}
                onSaveKeyword={() => saveKeyword(t.id)}
                onCancelEditKeyword={() => setEditingKeywordId(null)}
                onToggleActive={() => updateTrigger.mutate({ id: t.id, active: !t.active })}
                onChangeFlow={(newFlowId) => updateTrigger.mutate({ id: t.id, flowId: newFlowId })}
                onChangePublicReply={(text) => updateTrigger.mutate({ id: t.id, publicReplyText: text || null })}
                onDelete={() => handleDeleteTrigger(t)}
                onTest={() => {
                  setTestResult(null);
                  testTrigger.mutate(t.id);
                }}
                testing={testTrigger.isPending}
                testResult={testResult?.id === t.id ? testResult.message : null}
                updatePending={updateTrigger.isPending}
                deletePending={deleteTrigger.isPending}
              />
            ))}
            {!triggers?.length && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Nenhum trigger criado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function TriggerRow(props: {
  trigger: Trigger;
  flows: Flow[];
  expanded: boolean;
  onToggleExpand: () => void;
  editingKeyword: boolean;
  keywordDraft: string;
  onStartEditKeyword: () => void;
  onKeywordDraftChange: (v: string) => void;
  onSaveKeyword: () => void;
  onCancelEditKeyword: () => void;
  onToggleActive: () => void;
  onChangeFlow: (flowId: string) => void;
  onChangePublicReply: (text: string) => void;
  onDelete: () => void;
  onTest: () => void;
  testing: boolean;
  testResult: string | null;
  updatePending: boolean;
  deletePending: boolean;
}) {
  const { trigger: t, expanded } = props;

  const { data: detail } = useQuery({
    queryKey: ["trigger-detail", t.id],
    queryFn: () => api.get<TriggerDetail>(`/triggers/${t.id}`),
    enabled: expanded,
  });

  const [publicReplyDraft, setPublicReplyDraft] = useState(t.publicReplyText ?? "");
  const publicReplyEditRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="p-4">
          <button
            type="button"
            onClick={props.onToggleExpand}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            title="Abrir detalhes"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="p-4">
          <Badge variant={t.type === "comment" ? "rascunho" : "ativo"}>
            {t.type === "comment" ? "Comentário" : "DM"}
          </Badge>
        </td>
        <td className="p-4">
          {t.type === "comment" ? (
            <span className="max-w-[160px] truncate font-mono text-xs" title={t.postId ?? ""}>
              {t.postId}
            </span>
          ) : props.editingKeyword ? (
            <input
              autoFocus
              className="w-32 rounded-[var(--radius)] border border-border bg-background p-1.5 text-xs outline-none focus:ring-2 focus:ring-primary"
              value={props.keywordDraft}
              onChange={(e) => props.onKeywordDraftChange(e.target.value)}
              onBlur={props.onSaveKeyword}
              onKeyDown={(e) => {
                if (e.key === "Enter") props.onSaveKeyword();
                if (e.key === "Escape") props.onCancelEditKeyword();
              }}
            />
          ) : (
            <button
              type="button"
              onClick={props.onStartEditKeyword}
              className="rounded px-1.5 py-0.5 text-left hover:bg-muted"
              title="Clique pra editar"
            >
              {t.keyword ?? <span className="text-muted-foreground">qualquer comentário</span>}
            </button>
          )}
        </td>
        <td className="p-4">
          <select
            className="rounded-[var(--radius)] border border-border bg-background p-1.5 text-xs outline-none focus:ring-2 focus:ring-primary"
            value={t.flow.name}
            onChange={(e) => {
              const f = props.flows.find((fl) => fl.name === e.target.value);
              if (f) props.onChangeFlow(f.id);
            }}
          >
            <option value={t.flow.name}>{t.flow.name}</option>
            {props.flows
              .filter((f) => f.name !== t.flow.name)
              .map((f) => (
                <option key={f.id} value={f.name}>
                  {f.name}
                </option>
              ))}
          </select>
        </td>
        <td className="p-4">{t.hitCount}</td>
        <td className="p-4">
          <Badge variant={t.active ? "ativo" : "pausado"}>{t.active ? "Ativo" : "Pausado"}</Badge>
        </td>
        <td className="p-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={props.onTest}
              disabled={props.testing}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
              title="Disparar um evento de teste pra esse trigger"
            >
              <FlaskConical size={14} />
            </button>
            <button
              type="button"
              onClick={props.onToggleActive}
              disabled={props.updatePending}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title={t.active ? "Pausar automação" : "Reativar automação"}
            >
              {t.active ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              type="button"
              onClick={props.onDelete}
              disabled={props.deletePending}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger"
              title="Excluir automação"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
      {props.testResult && (
        <tr className="border-b border-border last:border-0 bg-muted/30">
          <td colSpan={7} className="px-4 py-2 text-xs text-muted-foreground">
            {props.testResult}
          </td>
        </tr>
      )}
      {expanded && (
        <tr className="border-b border-border bg-muted/20 last:border-0">
          <td colSpan={7} className="p-4">
            {t.type === "comment" && (
              <div className="mb-4 flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Resposta pública no comentário (opcional)
                </label>
                <input
                  ref={publicReplyEditRef}
                  className="w-full max-w-md rounded-[var(--radius)] border border-border bg-background p-1.5 text-xs outline-none focus:ring-2 focus:ring-primary"
                  value={publicReplyDraft}
                  placeholder="sem resposta pública configurada"
                  onChange={(e) => setPublicReplyDraft(e.target.value)}
                  onBlur={() => {
                    if (publicReplyDraft !== (t.publicReplyText ?? "")) props.onChangePublicReply(publicReplyDraft);
                  }}
                />
                <VariablePicker
                  variables={BUILTIN_VARIABLES}
                  fieldRef={publicReplyEditRef}
                  value={publicReplyDraft}
                  onChange={setPublicReplyDraft}
                />
              </div>
            )}
            <p className="mb-2 text-xs font-medium text-muted-foreground">Últimos disparos deste trigger</p>
            {!detail && <p className="text-xs text-muted-foreground">Carregando...</p>}
            {detail && detail.flowRuns.length === 0 && (
              <p className="text-xs text-muted-foreground">Ainda não disparou nenhum flow_run.</p>
            )}
            {detail && detail.flowRuns.length > 0 && (
              <ul className="flex flex-col gap-1">
                {detail.flowRuns.map((run) => (
                  <li key={run.id} className="flex items-center justify-between text-xs">
                    <span>{run.contact.name ?? run.contact.username ?? run.contact.igsid}</span>
                    <span className="text-muted-foreground">
                      {run.status} — {new Date(run.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
