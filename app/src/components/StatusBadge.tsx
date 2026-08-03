import type { ReportStatus } from "@/lib/contract";

const STYLES: Record<ReportStatus, string> = {
  submitted: "bg-pending-bg text-pending ring-1 ring-inset ring-pending/25",
  disputed: "bg-warning-bg text-warning ring-1 ring-inset ring-warning/25",
  valid: "bg-success-bg text-success ring-1 ring-inset ring-success/25",
  invalid: "bg-danger-bg text-danger ring-1 ring-inset ring-danger/25",
  duplicate: "bg-white/5 text-text-muted ring-1 ring-inset ring-white/10",
  unresolved: "bg-warning-bg text-warning ring-1 ring-inset ring-warning/25",
  withdrawn: "bg-white/5 text-text-muted ring-1 ring-inset ring-white/10",
};

const LABELS: Record<ReportStatus, string> = {
  submitted: "Awaiting review",
  disputed: "Under dispute",
  valid: "Valid — paid",
  invalid: "Invalid",
  duplicate: "Duplicate",
  unresolved: "Unresolved — retryable",
  withdrawn: "Withdrawn",
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
