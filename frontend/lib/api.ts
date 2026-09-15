const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type WorkspaceMembership = { id: string; name: string; role: "OWNER" | "ADMIN" | "MEMBER" };

// RF16 — toda chamada (exceto /auth/*) manda o workspace atual em
// X-Workspace-Id; o backend confere que o usuário é membro dele (ver
// backend/src/lib/auth.ts).
export function getCurrentWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("dmflow_workspace_id");
}

export function getWorkspaces(): WorkspaceMembership[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("dmflow_workspaces") ?? "[]");
  } catch {
    return [];
  }
}

export function setSession(token: string, workspaces: WorkspaceMembership[], workspaceId?: string): void {
  localStorage.setItem("dmflow_token", token);
  localStorage.setItem("dmflow_workspaces", JSON.stringify(workspaces));
  const current = workspaceId ?? workspaces[0]?.id;
  if (current) localStorage.setItem("dmflow_workspace_id", current);
}

export function setCurrentWorkspaceId(id: string): void {
  localStorage.setItem("dmflow_workspace_id", id);
}

export function clearSession(): void {
  localStorage.removeItem("dmflow_token");
  localStorage.removeItem("dmflow_workspaces");
  localStorage.removeItem("dmflow_workspace_id");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("dmflow_token") : null;
  const workspaceId = getCurrentWorkspaceId();

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401 && typeof window !== "undefined") {
    clearSession();
    window.location.href = "/login";
  }

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
