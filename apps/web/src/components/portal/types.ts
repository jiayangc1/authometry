export interface PortalMe {
  user: {
    id: string;
    email: string;
    name: string;
    groups: string[];
    passwordEnabled: boolean;
    mfaEnabled: boolean;
  };
  workspace: { id: string; name: string; slug: string };
  environment: { id: string; name: string };
  socialConnections: Array<{
    provider: "google" | "github";
    provider_email?: string;
    created_at: string;
  }>;
  sessions: Array<{
    id: string;
    application_name?: string;
    last_active_at: string;
    created_at: string;
    current: boolean;
  }>;
}
