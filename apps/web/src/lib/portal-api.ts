import { ApiClientError } from "./api";

function cookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
}

export function portalCsrfToken(): string {
  const value = cookie("authometry_portal_csrf");
  return value ? decodeURIComponent(value) : "";
}

export async function portalApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const csrf = portalCsrfToken();
  const response = await fetch(`/api/v1/portal${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(csrf ? { "x-authometry-portal-csrf": csrf } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => undefined)) as
      { error?: { code?: string; message?: string; details?: unknown } } | undefined;
    throw new ApiClientError(
      response.status,
      result?.error?.code ?? "request_failed",
      result?.error?.message ?? `Request failed with HTTP ${response.status}.`,
      result?.error?.details,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
