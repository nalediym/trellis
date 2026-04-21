import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "warn" | "danger";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const tones: Record<Tone, string> = {
    neutral:
      "bg-[color:var(--accent-soft)] text-[color:var(--text)] border-[color:var(--border)]",
    accent:
      "bg-[color:var(--accent-soft)] text-[color:var(--accent)] border-[color:var(--accent-soft)]",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warn: "bg-amber-50 text-amber-800 border-amber-100",
    danger: "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
