/** Shared Radix DropdownMenu styling so every floating menu moves and looks the same. */
export const menuContentClass =
  "motion-popover z-[var(--z-popover)] min-w-48 overscroll-contain rounded-[var(--radius-panel)] bg-[var(--surface-raised)] p-1 shadow-[var(--shadow-menu)]";

export const menuItemClass =
  "flex h-9 cursor-default items-center gap-2 rounded-[var(--radius-control)] px-2.5 text-[13px] text-[var(--text-primary)] outline-none select-none transition-colors duration-[var(--motion-instant)] data-[disabled]:pointer-events-none data-[disabled]:text-[var(--text-disabled)] data-[highlighted]:bg-[var(--surface-hover)] [&_svg]:size-4 [&_svg]:text-[var(--text-secondary)]";

export const menuDangerItemClass = `${menuItemClass} text-[var(--danger)] data-[highlighted]:bg-[var(--danger-soft)] [&_svg]:text-[var(--danger)]`;

export const menuLabelClass = "px-2.5 pt-2 pb-1 text-xs text-[var(--text-tertiary)]";

export const menuSeparatorClass = "-mx-1 my-1 h-px bg-[var(--border)]";
