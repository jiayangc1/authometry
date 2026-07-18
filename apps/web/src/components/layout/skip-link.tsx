export function SkipLink({ target = "main-content" }: { target?: string }) {
  return (
    <a
      className="fixed top-2 left-2 z-[100] -translate-y-16 rounded bg-[var(--foreground)] px-3 py-2 text-xs text-[var(--background)] focus-visible:translate-y-0 focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
      href={`#${target}`}
    >
      Skip to content
    </a>
  );
}
