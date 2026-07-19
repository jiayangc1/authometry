"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LoaderCircle, Mail, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import type { PortalMe } from "@/components/portal/types";
import { portalApiFetch } from "@/lib/portal-api";

export default function PortalProfilePage() {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["portal-me"],
    queryFn: () => portalApiFetch<PortalMe>("/me"),
  });
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me.data) setName(me.data.user.name);
  }, [me.data]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await portalApiFetch("/profile", { method: "PATCH", body: JSON.stringify({ name }) });
      await queryClient.invalidateQueries({ queryKey: ["portal-me"] });
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <p className="portal-caption mb-1">YOUR IDENTITY</p>
        <h1 className="text-2xl font-semibold tracking-[-0.035em]">Profile</h1>
        <p className="mt-2 text-sm text-[var(--portal-muted)]">
          Keep the name shown to your company applications up to date.
        </p>
      </header>
      <section className="overflow-hidden rounded-xl border border-[var(--portal-line)] bg-[var(--portal-paper)]">
        <div className="flex items-center gap-4 border-b border-[var(--portal-line)] px-5 py-5 sm:px-6">
          <span className="flex size-12 items-center justify-center rounded-full bg-[var(--portal-accent-soft)] text-[var(--portal-accent)]">
            <UserRound aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{me.data?.user.name}</p>
            <p className="truncate text-xs text-[var(--portal-muted)]">{me.data?.user.email}</p>
          </div>
        </div>
        <form className="space-y-5 px-5 py-6 sm:px-6" onSubmit={save}>
          <label className="block max-w-lg">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              <UserRound aria-hidden="true" className="size-3.5 text-[var(--portal-muted)]" /> Full
              name
            </span>
            <input
              autoComplete="name"
              className={inputClass}
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label className="block max-w-lg">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              <Mail aria-hidden="true" className="size-3.5 text-[var(--portal-muted)]" /> Work email
            </span>
            <input
              className={`${inputClass} opacity-70`}
              disabled
              value={me.data?.user.email ?? ""}
            />
            <span className="mt-1 block text-[11px] text-[var(--portal-muted)]">
              Your workspace administrator manages your email address.
            </span>
          </label>
          <div className="max-w-lg rounded-lg border border-[var(--portal-line)] bg-[var(--portal-canvas)] p-4">
            <div className="flex items-center gap-2">
              <Building2 aria-hidden="true" className="size-4 text-[var(--portal-accent)]" />
              <p className="text-xs font-semibold">{me.data?.workspace.name}</p>
            </div>
            <p className="mt-1 text-[11px] text-[var(--portal-muted)]">
              Groups: {me.data?.user.groups.join(", ") || "No groups assigned"}
            </p>
          </div>
          <div className="flex justify-end border-t border-[var(--portal-line)] pt-4">
            <Button
              disabled={saving || !name.trim() || name === me.data?.user.name}
              type="submit"
              variant="primary"
            >
              {saving && <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />}
              Save changes
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
