"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, LoaderCircle, Mail, Trash2, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import type { PortalMe } from "@/components/portal/types";
import { PortalAvatar } from "@/components/portal/portal-avatar";
import { portalApiFetch } from "@/lib/portal-api";

export default function PortalProfilePage() {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["portal-me"],
    queryFn: () => portalApiFetch<PortalMe>("/me"),
  });
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Choose an image smaller than 5 MB.");
      return;
    }
    setUploading(true);
    try {
      await portalApiFetch("/profile/avatar", {
        method: "PUT",
        body: file,
        headers: { "content-type": file.type },
      });
      await queryClient.invalidateQueries({ queryKey: ["portal-me"] });
      toast.success("Profile picture updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile picture could not be updated.");
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setUploading(true);
    try {
      await portalApiFetch("/profile/avatar", { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["portal-me"] });
      toast.success("Profile picture removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile picture could not be removed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-9">
        <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.045em]">
          Your profile
        </h1>
        <p className="mt-2 text-sm text-[var(--portal-muted)]">
          Choose how you appear across your workspace and connected apps.
        </p>
      </header>
      <section className="overflow-hidden rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-paper)] shadow-[0_1px_2px_rgba(20,20,30,.03)]">
        <div className="grid border-b border-[var(--portal-line)] sm:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-center justify-center bg-[var(--portal-accent-soft)] px-6 py-9 text-center">
            <div className="relative">
              <PortalAvatar
                className="size-28 bg-[var(--portal-paper)] shadow-[0_12px_30px_rgba(60,45,150,.14)] ring-4 ring-[var(--portal-paper)]"
                initialsClassName="text-2xl"
                name={me.data?.user.name ?? "User"}
                src={me.data?.user.avatarUrl ?? null}
              />
              <button
                aria-label="Choose profile picture"
                className="absolute right-0 bottom-0 flex size-9 items-center justify-center rounded-full bg-[var(--portal-ink)] text-white shadow-md transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                type="button"
              >
                {uploading ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Camera aria-hidden="true" className="size-4" />
                )}
              </button>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => void uploadAvatar(event)}
                ref={fileInput}
                type="file"
              />
            </div>
            <p className="mt-4 text-sm font-semibold">{me.data?.user.name}</p>
            <p className="mt-0.5 max-w-full truncate text-[11px] text-[var(--portal-muted)]">
              {me.data?.user.email}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Button
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                size="compact"
                type="button"
                variant="secondary"
              >
                Choose photo
              </Button>
              {me.data?.user.avatarUrl && (
                <Button
                  aria-label="Remove profile picture"
                  disabled={uploading}
                  onClick={() => void removeAvatar()}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </Button>
              )}
            </div>
            <p className="mt-3 text-[10px] leading-4 text-[var(--portal-muted)]">
              JPG, PNG or WebP · 5 MB max
            </p>
          </div>
          <form className="space-y-5 px-5 py-7 sm:px-8 sm:py-9" onSubmit={save}>
            <div>
              <h2 className="text-sm font-semibold">Personal details</h2>
              <p className="mt-1 text-xs text-[var(--portal-muted)]">
                Your name is shared with apps when you sign in.
              </p>
            </div>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                <UserRound aria-hidden="true" className="size-3.5 text-[var(--portal-muted)]" />{" "}
                Full name
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
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                <Mail aria-hidden="true" className="size-3.5 text-[var(--portal-muted)]" /> Work
                email
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
            <div className="rounded-xl bg-[var(--portal-canvas)] px-4 py-3">
              <p className="text-xs font-medium">{me.data?.workspace.name}</p>
              <p className="mt-0.5 text-[11px] text-[var(--portal-muted)]">
                {me.data?.user.groups.length
                  ? me.data.user.groups.join(" · ")
                  : "No groups assigned"}
              </p>
            </div>
            <div className="flex justify-end pt-1">
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
        </div>
      </section>
    </div>
  );
}
