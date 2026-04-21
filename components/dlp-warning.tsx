import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DlpFinding } from "@/lib/dlp";

interface Props {
  stage: "input" | "output";
  findings: DlpFinding[];
  blocked?: boolean;
}

export function DlpWarning({ stage, findings, blocked = false }: Props) {
  const actionable = findings.filter((f) => f.severity !== "info");
  const hasAny = actionable.length > 0;

  if (blocked) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 mt-0.5 text-red-700" aria-hidden />
          <div className="text-[13px] text-red-900">
            <strong className="font-semibold">Blocked.</strong> The{" "}
            {stage === "input" ? "input" : "output"} contained restricted
            content and was not forwarded to the model.
            <Findings findings={actionable} />
          </div>
        </div>
      </div>
    );
  }

  if (hasAny) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
        <div className="flex items-start gap-2">
          <ShieldQuestion
            className="h-4 w-4 mt-0.5 text-amber-700"
            aria-hidden
          />
          <div className="text-[13px] text-amber-900">
            <strong className="font-semibold">DLP findings.</strong>{" "}
            {actionable.length} item(s) detected and redacted from the{" "}
            {stage === "input" ? "input" : "output"}.
            <Findings findings={actionable} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3">
      <div className="flex items-start gap-2">
        <ShieldCheck
          className="h-4 w-4 mt-0.5 text-emerald-700"
          aria-hidden
        />
        <div className="text-[13px] text-emerald-900">
          <strong className="font-semibold">Clean.</strong> No DLP findings on{" "}
          {stage === "input" ? "input" : "output"}.
        </div>
      </div>
    </div>
  );
}

function Findings({ findings }: { findings: DlpFinding[] }) {
  if (findings.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {findings.map((f, i) => (
        <li key={`${f.rule_id}-${i}`}>
          <Badge tone={f.severity === "block" ? "danger" : "warn"}>
            {f.rule_id} · {f.label}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
