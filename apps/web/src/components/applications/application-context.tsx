"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { apiFetch } from "@/lib/api";

export interface ApplicationDetail {
  id: string;
  name: string;
  slug: string;
  client_id: string;
  type: string;
  status: "active" | "disabled";
  description?: string;
  logo_uri?: string | null;
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  require_pkce: boolean;
  require_consent: boolean;
  allowed_scopes: string[];
  access_token_lifetime_seconds: number;
  refresh_token_lifetime_seconds: number;
  authorization_code_lifetime_seconds: number;
  rotate_refresh_tokens: boolean;
  portal_enabled: boolean;
  launch_uri?: string;
  provisioning_enabled: boolean;
  ownership: "dashboard" | "manifest";
  manifest_path?: string;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
  version: number;
  credentials: Array<{
    id: string;
    name: string;
    prefix: string;
    expires_at?: string;
    last_used_at?: string;
    revoked_at?: string;
    created_at: string;
  }>;
}

const Context = createContext<{
  application?: ApplicationDetail;
  loading: boolean;
  error?: Error;
  refetch: () => Promise<unknown>;
}>({ loading: true, refetch: () => Promise.resolve(undefined) });

export function ApplicationProvider({
  applicationId,
  children,
}: {
  applicationId: string;
  children: React.ReactNode;
}) {
  const query = useQuery({
    queryKey: ["application", applicationId],
    queryFn: () => apiFetch<ApplicationDetail>(`/api/v1/applications/${applicationId}`),
  });
  return (
    <Context.Provider
      value={{
        ...(query.data ? { application: query.data } : {}),
        loading: query.isLoading,
        ...(query.error ? { error: query.error } : {}),
        refetch: query.refetch,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useApplication() {
  return useContext(Context);
}
