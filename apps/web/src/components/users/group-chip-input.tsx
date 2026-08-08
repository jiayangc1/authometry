"use client";

import { X } from "lucide-react";
import { useState } from "react";

interface GroupChipInputProps {
  disabled?: boolean;
  groups: string[];
  onChange: (groups: string[]) => void;
}

export function GroupChipInput({ disabled = false, groups, onChange }: GroupChipInputProps) {
  const [draft, setDraft] = useState("");

  function addGroup() {
    const group = draft.trim();
    if (!group) return;

    if (!groups.some((value) => value.toLocaleLowerCase() === group.toLocaleLowerCase())) {
      onChange([...groups, group]);
    }
    setDraft("");
  }

  function removeGroup(index: number) {
    onChange(groups.filter((_, groupIndex) => groupIndex !== index));
  }

  return (
    <div className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2 py-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.02)] transition-[border-color,box-shadow] focus-within:border-[var(--focus)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
      {groups.map((group, index) => (
        <span
          className="inline-flex h-6 max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-hover)] pr-1 pl-2.5 text-xs font-medium text-[var(--text-primary)]"
          key={`${group}-${index}`}
        >
          <span className="truncate">{group}</span>
          <button
            aria-label={`Remove ${group}`}
            className="flex size-4 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            disabled={disabled}
            onClick={() => removeGroup(index)}
            type="button"
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        </span>
      ))}
      <input
        aria-label="Add a group"
        autoComplete="off"
        className="h-6 min-w-28 flex-1 bg-transparent px-1 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none disabled:cursor-not-allowed"
        disabled={disabled || groups.length >= 50}
        maxLength={64}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addGroup();
          } else if (event.key === "Backspace" && !draft && groups.length) {
            removeGroup(groups.length - 1);
          }
        }}
        placeholder={groups.length ? "Add another…" : "Type a group and press Enter…"}
        value={draft}
      />
    </div>
  );
}
