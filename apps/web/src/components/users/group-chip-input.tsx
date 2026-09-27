"use client";

import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@authometry/ui";
import { apiFetch } from "@/lib/api";

interface GroupChipInputProps {
  disabled?: boolean;
  groups: string[];
  id?: string;
  onChange: (groups: string[]) => void;
}

export function GroupChipInput({ disabled = false, groups, id, onChange }: GroupChipInputProps) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const suggestions = useQuery({
    queryKey: ["groups"],
    queryFn: () => apiFetch<{ data: Array<{ id: string; name: string }> }>("/api/v1/groups"),
    staleTime: 60_000,
  });
  const available = (suggestions.data?.data ?? []).filter(
    (group) => !groups.some((value) => value.toLowerCase() === group.name.toLowerCase()),
  );

  function addGroup(value = draft) {
    const group = value.trim().replace(/,$/, "").trim();
    if (!group) return;
    if (!groups.some((existing) => existing.toLocaleLowerCase() === group.toLocaleLowerCase())) {
      onChange([...groups, group]);
    }
    setDraft("");
  }

  function removeGroup(index: number) {
    onChange(groups.filter((_, groupIndex) => groupIndex !== index));
  }

  return (
    <div
      className={cn(
        "flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-1 transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus-within:border-[var(--text-tertiary)] focus-within:shadow-[0_0_0_3px_var(--geist-gray-alpha-200)] hover:border-[var(--border-strong)]",
        disabled && "cursor-not-allowed bg-[var(--surface-subtle)]",
      )}
      onClick={(event) => event.currentTarget.querySelector("input")?.focus()}
    >
      {groups.map((group, index) => (
        <span
          className="animate-pop inline-flex h-6 max-w-full items-center gap-1 rounded-[4px] bg-[var(--geist-gray-100)] pr-0.5 pl-2 text-xs font-medium text-[var(--text-primary)]"
          key={`${group}-${index}`}
        >
          <span className="truncate">{group}</span>
          <button
            aria-label={`Remove ${group}`}
            className="pressable flex size-5 shrink-0 items-center justify-center rounded-[3px] text-[var(--text-tertiary)] hover:bg-[var(--surface-active)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              removeGroup(index);
            }}
            type="button"
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        </span>
      ))}
      <input
        aria-label="Add a group"
        autoComplete="off"
        className="h-6 min-w-32 flex-1 bg-transparent px-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none disabled:cursor-not-allowed"
        disabled={disabled || groups.length >= 50}
        id={id}
        list={listId}
        maxLength={64}
        onBlur={() => addGroup()}
        onChange={(event) => {
          const value = event.target.value;
          if (value.endsWith(",")) addGroup(value);
          else if (available.some((group) => group.name === value)) addGroup(value);
          else setDraft(value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addGroup();
          } else if (event.key === "Backspace" && !draft && groups.length) {
            removeGroup(groups.length - 1);
          }
        }}
        placeholder={groups.length ? "Add another…" : "Type a group, then Enter or comma…"}
        value={draft}
      />
      <datalist id={listId}>
        {available.map((group) => (
          <option key={group.id} value={group.name} />
        ))}
      </datalist>
    </div>
  );
}
