"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useContractRead } from "@/lib/useContractRead";
import { useWallet } from "@/lib/wallet";
import { useTransaction } from "@/lib/useTransaction";
import {
  acceptReport,
  disputeReport,
  readProgramInfo,
  readReport,
  resolveDispute,
  withdrawUnresolved,
  type ProgramInfo,
  type Report,
} from "@/lib/contract";
import { StatusBadge } from "@/components/StatusBadge";
import { TxProgress } from "@/components/TxProgress";
import { EXPLORER_TX_URL } from "@/lib/config";

function sameAddress(a?: string | null, b?: string | null) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const reportId = Number(id);
  const wallet = useWallet();

  const report = useContractRead<Report>(
    (client) => readReport(client, reportId),
    [reportId]
  );
  const program = useContractRead<ProgramInfo>((client) => readProgramInfo(client), []);

  const tx = useTransaction();
  const [bountyAmount, setBountyAmount] = useState("");

  if (report.status === "loading") {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-14">
        <div className="animate-pulse space-y-4" aria-busy="true">
          <div className="h-6 w-2/3 bg-white/10 rounded" />
          <div className="h-4 w-full bg-white/10 rounded" />
          <div className="h-4 w-5/6 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  if (report.status === "error") {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-14">
        <div className="rounded-lg border border-danger/30 bg-danger-bg p-4 text-sm text-danger">
          <p className="font-medium">Couldn&rsquo;t load this report.</p>
          <p className="mt-1">{report.error}</p>
        </div>
        <Link
          href="/reports"
          className="mt-4 inline-block text-sm underline decoration-dotted"
        >
          ← Back to all reports
        </Link>
      </div>
    );
  }

  const data = report.data;
  const isMaintainer = sameAddress(wallet.address, program.status === "ready" ? program.data.maintainer : null);
  const isReporter = sameAddress(wallet.address, data.reporter);
  const bountyValue = Number(bountyAmount || 0);

  async function withWallet<T>(action: (client: NonNullable<typeof wallet.client>) => Promise<T>) {
    if (!wallet.client) {
      tx.run(async () => {
        throw new Error("Connect a wallet first.");
      });
      return;
    }
    tx.run(async (onStatus) => {
      const receipt = await action(wallet.client!);
      void onStatus;
      report.refetch();
      program.refetch();
      return { hash: (receipt as { hash?: string })?.hash ?? "" };
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-14">
      <Link
        href="/reports"
        className="text-sm text-text-muted hover:text-text transition-colors"
      >
        ← All reports
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
        <StatusBadge status={data.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-text-faint">Reporter</dt>
          <dd className="font-mono text-xs break-all">{data.reporter}</dd>
        </div>
        <div>
          <dt className="text-text-faint">Bond</dt>
          <dd>{data.bond} wei</dd>
        </div>
        <div>
          <dt className="text-text-faint">Submitted</dt>
          <dd>{new Date(data.created_at).toLocaleString()}</dd>
        </div>
        {data.resolved_at && (
          <div>
            <dt className="text-text-faint">Resolved</dt>
            <dd>{new Date(data.resolved_at).toLocaleString()}</dd>
          </div>
        )}
      </dl>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-text-muted">Description</h2>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
          {data.description}
        </p>
      </div>

      {data.evidence_url && (
        <div className="mt-4">
          <h2 className="text-sm font-medium text-text-muted">Evidence</h2>
          <a
            href={data.evidence_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm underline decoration-dotted break-all"
          >
            {data.evidence_url}
          </a>
        </div>
      )}

      {data.verdict_reason && (
        <div className="mt-4 glass glow rounded-xl p-4">
          <h2 className="text-sm font-medium text-accent tracking-wide uppercase">
            Consensus verdict reasoning
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed">{data.verdict_reason}</p>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {tx.state.phase === "running" && (
          <TxProgress
            status={tx.state.status}
            elapsedSeconds={tx.elapsed}
            hash={tx.state.hash}
            explorerUrl={tx.state.hash ? EXPLORER_TX_URL(tx.state.hash) : undefined}
          />
        )}
        {tx.state.phase === "error" && (
          <div role="alert" className="rounded-lg border border-danger/30 bg-danger-bg p-4 text-sm text-danger">
            {tx.state.message}
          </div>
        )}
        {tx.state.phase === "done" && (
          <div className="rounded-lg border border-success/30 bg-success-bg p-4 text-sm text-success">
            Transaction accepted. It can still change during the appeal window
            before it finalizes.
            {tx.state.hash && (
              <a
                href={EXPLORER_TX_URL(tx.state.hash)}
                target="_blank"
                rel="noreferrer"
                className="block mt-1 underline decoration-dotted"
              >
                View on explorer ↗
              </a>
            )}
          </div>
        )}

        {!wallet.client && data.status !== "withdrawn" && (
          <p className="text-sm text-text-muted">
            Connect a wallet to act on this report.
          </p>
        )}

        {wallet.client && data.status === "submitted" && isReporter && (
          <button
            type="button"
            disabled={tx.state.phase === "running"}
            onClick={() => withWallet((client) => withdrawUnresolved(client, reportId))}
            className="hairline rounded-md px-4 py-2 text-sm font-medium hover:bg-surface transition-colors disabled:opacity-40"
          >
            Withdraw report and reclaim bond
          </button>
        )}

        {wallet.client && data.status === "submitted" && isMaintainer && (
          <div className="glass rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium">Maintainer actions</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={bountyAmount}
                onChange={(e) => setBountyAmount(e.target.value)}
                placeholder="Bounty amount (wei)"
                className="flex-1 rounded-md hairline bg-bg px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={tx.state.phase === "running"}
                onClick={() =>
                  withWallet((client) => acceptReport(client, reportId, bountyValue))
                }
                className="cyber-border rounded-md bg-gradient-to-r from-accent to-accent-2 text-accent-contrast px-3 py-1.5 text-sm font-medium hover:brightness-110 transition-all disabled:opacity-40"
              >
                Accept &amp; pay
              </button>
            </div>
            <button
              type="button"
              disabled={tx.state.phase === "running"}
              onClick={() => withWallet((client) => disputeReport(client, reportId))}
              className="w-full rounded-md border border-warning/40 text-warning px-3 py-1.5 text-sm font-medium hover:bg-warning-bg transition-colors disabled:opacity-40"
            >
              Dispute this report
            </button>
          </div>
        )}

        {wallet.client && data.status === "disputed" && (
          <div className="glass rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium">Resolve dispute</p>
            <p className="text-xs text-text-muted">
              Anyone can trigger resolution — it runs a GenLayer consensus
              round that fetches the repo&rsquo;s issue history and judges the
              report. This can take a few minutes.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={bountyAmount}
                onChange={(e) => setBountyAmount(e.target.value)}
                placeholder="Bounty amount if valid (wei)"
                className="flex-1 rounded-md hairline bg-bg px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={tx.state.phase === "running"}
                onClick={() =>
                  withWallet((client) => resolveDispute(client, reportId, bountyValue))
                }
                className="cyber-border rounded-md bg-gradient-to-r from-accent to-accent-2 text-accent-contrast px-3 py-1.5 text-sm font-medium hover:brightness-110 transition-all disabled:opacity-40"
              >
                Resolve
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
