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
    const refreshed = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: csrf ? { "x-authometry-csrf": decodeURIComponent(csrf) } : {},
    });
    if (refreshed.ok) return apiFetch<T>(path, init, false);
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
