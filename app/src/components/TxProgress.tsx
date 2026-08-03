"use client";

import { TransactionStatus } from "genlayer-js/types";

const STAGES: TransactionStatus[] = [
  TransactionStatus.PENDING,
  TransactionStatus.PROPOSING,
  TransactionStatus.COMMITTING,
  TransactionStatus.REVEALING,
  TransactionStatus.ACCEPTED,
];

const STAGE_LABEL: Partial<Record<TransactionStatus, string>> = {
  [TransactionStatus.PENDING]: "Queued",
  [TransactionStatus.PROPOSING]: "Leader proposing",
  [TransactionStatus.COMMITTING]: "Validators committing",
  [TransactionStatus.REVEALING]: "Validators revealing",
  [TransactionStatus.ACCEPTED]: "Accepted",
  [TransactionStatus.FINALIZED]: "Finalized",
};

export function TxProgress({
  status,
  elapsedSeconds,
  hash,
  explorerUrl,
}: {
  status: TransactionStatus | null;
  elapsedSeconds: number;
  hash?: string;
  explorerUrl?: string;
}) {
  if (!status) return null;

  const isTerminalBad =
    status === TransactionStatus.UNDETERMINED ||
    status === TransactionStatus.VALIDATORS_TIMEOUT ||
    status === TransactionStatus.LEADER_TIMEOUT ||
    status === TransactionStatus.CANCELED;

  const currentIndex = STAGES.indexOf(status);

  return (
    <div className="glass rounded-xl p-4 space-y-3 ring-1 ring-inset ring-pending/20">
      {!isTerminalBad && (
        <>
          <div className="flex items-center justify-between text-xs text-pending">
            <span className="font-medium flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-pending animate-pulse" aria-hidden />
              {STAGE_LABEL[status] ?? status} · consensus in progress
            </span>
            <span aria-live="polite">{elapsedSeconds}s elapsed</span>
          </div>
          <ol className="flex items-center gap-1">
            {STAGES.map((stage, i) => (
              <li
                key={stage}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= currentIndex
                    ? "bg-gradient-to-r from-accent to-accent-2"
                    : "bg-pending/15"
                }`}
                aria-hidden
              />
            ))}
          </ol>
          <p className="text-xs text-text-muted">
            This can take a few minutes — GenLayer validators are actually
            fetching data and reasoning about it, not just confirming a block.
          </p>
        </>
      )}

      {isTerminalBad && (
        <div>
          <p className="font-medium text-warning">
            {status === TransactionStatus.UNDETERMINED &&
              "Validators couldn't reach agreement — nothing was written."}
            {status === TransactionStatus.VALIDATORS_TIMEOUT &&
              "Validators timed out — nothing was written."}
            {status === TransactionStatus.LEADER_TIMEOUT &&
              "The leader timed out — nothing was written."}
            {status === TransactionStatus.CANCELED && "Transaction was canceled."}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            This is a retryable outcome, not an error in your data. You can
            safely try again.
          </p>
        </div>
      )}

      {hash && explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs underline decoration-dotted text-pending"
        >
          View on explorer ↗
        </a>
      )}
    </div>
  );
}
