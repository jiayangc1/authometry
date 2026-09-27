"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Spinner } from "@authometry/ui";
import { Field, Input } from "@/components/ui/form";
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
      toast.success("Profile updated.");
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
      toast.success("Profile picture updated.");
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
      toast.success("Profile picture removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile picture could not be removed.");
    } finally {
      setUploading(false);
    }
  }

  const dirty = Boolean(me.data && name.trim() && name !== me.data.user.name);
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl leading-8 font-semibold tracking-[-0.03em] sm:text-[32px] sm:leading-10">
          Profile
        </h1>
        <p className="mt-1 text-sm text-[var(--portal-muted)]">
          How you appear across your workspace and connected apps.
        </p>
      </header>
      <div className="space-y-5">
        <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--portal-line)] bg-[var(--portal-paper)]">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="relative w-fit">
              <PortalAvatar
                className="size-20 ring-1 ring-[var(--portal-line)]"
                initialsClassName="text-xl"
                name={me.data?.user.name ?? "User"}
                src={me.data?.user.avatarUrl ?? null}
              />
              <button
                aria-label="Choose profile picture"
                className="pressable absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-raised)] hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                type="button"
              >
                {uploading ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Camera aria-hidden="true" className="size-3.5" />
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
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Profile picture</h2>
              <p className="mt-0.5 text-[13px] text-[var(--portal-muted)]">
                JPG, PNG, or WebP up to 5 MB. Shown to apps that request your profile.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  disabled={uploading}
                  onClick={() => fileInput.current?.click()}
                  size="compact"
                  type="button"
                >
                  <Upload aria-hidden="true" className="size-3.5" /> Upload photo
                </Button>
                {me.data?.user.avatarUrl && (
                  <Button
                    className="hover:text-[var(--danger)]"
                    disabled={uploading}
                    onClick={() => void removeAvatar()}
                    size="compact"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" /> Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
        <form
          className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--portal-line)] bg-[var(--portal-paper)]"
          onSubmit={save}
        >
          <div className="space-y-4 p-5 sm:p-6">
            <div>
              <h2 className="text-sm font-semibold">Personal details</h2>
              <p className="mt-0.5 text-[13px] text-[var(--portal-muted)]">
                Your name is shared with apps when you sign in.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input
                  autoComplete="name"
                  minLength={2}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </Field>
              <Field description="Managed by your workspace administrator." label="Work email">
                <Input disabled value={me.data?.user.email ?? ""} />
              </Field>
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-medium">Groups in {me.data?.workspace.name}</p>
              {me.data?.user.groups.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {me.data.user.groups.map((group) => (
                    <span
                      className="rounded-[4px] bg-[var(--geist-gray-100)] px-2 py-0.5 text-xs font-medium"
                      key={group}
                    >
                      {group}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[var(--portal-muted)]">No groups assigned.</p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[var(--portal-line)] bg-[var(--surface-subtle)] px-5 py-3 sm:px-6">
            <p className="text-[13px] text-[var(--portal-muted)]">
              {dirty
                ? "You have unsaved changes."
                : "Changes apply the next time you sign in to an app."}
            </p>
            <Button
              disabled={!dirty}
              loading={saving}
              size="compact"
              type="submit"
              variant="primary"
            >
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
