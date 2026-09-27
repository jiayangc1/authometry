"use client";

import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";

export interface Environment {
  id: string;
  slug: string;
  name: string;
  kind: string;
  issuer: string;
  is_default: boolean;
}

function readEnvironmentCookie(): string {
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("authometry_environment="))
    ?.split("=")
    .slice(1)
    .join("=");
  try {
    return value ? decodeURIComponent(value) : "";
  } catch {
    return "";
  }
}

const noop = () => () => undefined;

/** The environment the dashboard is currently scoped to (cookie, falling back to the default). */
export function useActiveEnvironment() {
  const slug = useSyncExternalStore(noop, readEnvironmentCookie, () => "");
  const environments = useQuery({
    queryKey: ["environments"],
    queryFn: () => apiFetch<{ data: Environment[] }>("/api/v1/environments"),
  });
  const list = environments.data?.data ?? [];
  const active =
    list.find((environment) => environment.slug === slug) ??
    list.find((environment) => environment.is_default);
  return { active, environments: list, loading: environments.isLoading };
}
