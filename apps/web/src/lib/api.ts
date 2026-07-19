function cookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
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
  const refresh = async () => {
    const currentCsrf = cookie("authometry_csrf");

    // Another tab may have refreshed while this request waited for the lock. Its
    // new access cookie is already available to this tab, so rotating again is unnecessary.
    if (csrf && currentCsrf && currentCsrf !== csrf) return true;

    const response = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: currentCsrf
        ? { "x-authometry-csrf": decodeURIComponent(currentCsrf) }
        : {},
    });
    return response.ok;
  };

  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("authometry-session-refresh", refresh);
  }
  return refresh();
}

function refreshSession(csrf: string | undefined): Promise<boolean> {
  refreshPromise ??= requestSessionRefresh(csrf).finally(() => {
    refreshPromise = undefined;
  });
  return refreshPromise;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const csrf = cookie("authometry_csrf");
  const environment = cookie("authometry_environment");
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(csrf ? { "x-authometry-csrf": decodeURIComponent(csrf) } : {}),
      ...(environment ? { "x-authometry-environment": decodeURIComponent(environment) } : {}),
      ...init.headers,
    },
  });
  if (response.status === 401 && retry && !path.includes("/auth/refresh")) {
    if (await refreshSession(csrf)) return apiFetch<T>(path, init, false);
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
