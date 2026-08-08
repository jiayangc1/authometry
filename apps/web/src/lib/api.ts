function cookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
}

function decodedCookie(name: string): string | undefined {
  const value = cookie(name);
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

let refreshPromise: Promise<boolean> | undefined;

async function requestSessionRefresh(csrf: string | undefined): Promise<boolean> {
  async function refresh(csrfToken: string | undefined): Promise<Response> {
    return fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: csrfToken ? { "x-authometry-csrf": csrfToken } : {},
    });
  }

  const response = await refresh(csrf);
  if (response.ok || response.status !== 403) return response.ok;

  const result = (await response.json().catch(() => undefined)) as
    { error?: { code?: string } } | undefined;
  if (result?.error?.code !== "csrf_failed") return false;

  const csrfResponse = await fetch("/api/v1/auth/csrf", { credentials: "include" });
  if (!csrfResponse.ok) return false;
  const csrfResult = (await csrfResponse.json()) as { csrfToken: string };
  return (await refresh(csrfResult.csrfToken)).ok;
}

function refreshSession(csrf: string | undefined): Promise<boolean> {
  refreshPromise ??= requestSessionRefresh(csrf).finally(() => {
    refreshPromise = undefined;
  });
  return refreshPromise;
}

export function renewDashboardSession(): Promise<boolean> {
  return refreshSession(decodedCookie("authometry_csrf"));
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const csrf = decodedCookie("authometry_csrf");
  const environment = decodedCookie("authometry_environment");
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(csrf ? { "x-authometry-csrf": csrf } : {}),
      ...(environment ? { "x-authometry-environment": environment } : {}),
      ...init.headers,
    },
  });
  if (response.status === 401 && retry && !path.includes("/auth/refresh")) {
    if (await renewDashboardSession()) return apiFetch<T>(path, init, false);
  }
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
