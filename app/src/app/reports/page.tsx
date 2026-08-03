"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useContractRead } from "@/lib/useContractRead";
import { readReport, readReportIds, type Report } from "@/lib/contract";
import { StatusBadge } from "@/components/StatusBadge";

async function fetchAllReports(client: Parameters<typeof readReport>[0]) {
  const ids = await readReportIds(client);
  const sorted = [...ids].sort((a, b) => b - a);
  const reports = await Promise.all(sorted.map((id) => readReport(client, id)));
  return reports;
}

function RowSkeleton() {
  return (
    <div className="animate-pulse glass rounded-xl p-4 space-y-2">
      <div className="h-4 w-1/3 bg-white/10 rounded" />
      <div className="h-3 w-1/2 bg-white/10 rounded" />
    </div>
  );
}

export default function ReportsPage() {
  const result = useContractRead<Report[]>(fetchAllReports, []);
  const { status, refetch } = result;

  const empty = status === "ready" && result.data.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-text-muted">
            Every report ever submitted to this program, newest first.
          </p>
        </div>
        <Link
          href="/submit"
          className="cyber-border shrink-0 rounded-md bg-gradient-to-r from-accent to-accent-2 text-accent-contrast px-3.5 py-2 text-sm font-medium hover:brightness-110 transition-all"
        >
          Submit a report
        </Link>
      </div>

      {status === "loading" && (
        <div className="space-y-3" aria-live="polite" aria-busy="true">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      )}

      {result.status === "error" && (
        <div className="rounded-lg border border-danger/30 bg-danger-bg p-4 text-sm text-danger">
          <p className="font-medium">Couldn&rsquo;t load reports.</p>
          <p className="mt-1">{result.error}</p>
          <button
            type="button"
            onClick={refetch}
            className="mt-3 rounded-md border border-danger/40 px-3 py-1.5 text-xs font-medium hover:bg-danger/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {empty && (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
          <p className="font-medium">No reports yet</p>
          <p className="mt-1.5 text-sm text-text-muted max-w-sm mx-auto">
            Found a vulnerability? Be the first to stake a bond and submit a
            report — you don&rsquo;t need to trust the maintainer to see it
            resolved fairly.
          </p>
          <Link
            href="/submit"
            className="cyber-border mt-4 inline-block rounded-md bg-gradient-to-r from-accent to-accent-2 text-accent-contrast px-4 py-2 text-sm font-medium hover:brightness-110 transition-all"
          >
            Submit the first report
          </Link>
        </div>
      )}

      {result.status === "ready" && result.data.length > 0 && (
        <ReportList reports={result.data} />
      )}
    </div>
  );
}

function ReportList({ reports }: { reports: Report[] }) {
  const grouped = useMemo(() => reports, [reports]);
  return (
    <ul className="space-y-3">
      {grouped.map((report) => (
        <li key={report.id}>
          <Link
            href={`/reports/${report.id}`}
            className="glass block rounded-xl p-4 hover:ring-1 hover:ring-accent/40 transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium truncate">{report.title}</p>
                <p className="mt-1 text-xs text-text-faint font-mono">
                  #{report.id} · {report.reporter.slice(0, 8)}…
                  {report.reporter.slice(-6)}
                </p>
              </div>
              <StatusBadge status={report.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
