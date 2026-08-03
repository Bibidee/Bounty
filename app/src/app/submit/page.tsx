"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { useContractRead } from "@/lib/useContractRead";
import { useTransaction } from "@/lib/useTransaction";
import { readProgramInfo, submitReport, type ProgramInfo } from "@/lib/contract";
import { TxProgress } from "@/components/TxProgress";
import { EXPLORER_TX_URL } from "@/lib/config";

export default function SubmitPage() {
  const wallet = useWallet();
  const program = useContractRead<ProgramInfo>((client) => readProgramInfo(client), []);
  const tx = useTransaction();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [bond, setBond] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const minBond = program.status === "ready" ? program.data.min_bond : null;

  function validate(): string | null {
    if (!title.trim() || !description.trim()) {
      return "Title and description are required.";
    }
    const bondValue = Number(bond);
    if (!Number.isFinite(bondValue) || bondValue <= 0) {
      return "Enter a bond amount greater than zero.";
    }
    if (minBond !== null && bondValue < minBond) {
      return `The bond must be at least ${minBond} wei.`;
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    if (!wallet.client) return;

    await tx.run(async (onStatus) => {
      const receipt = await submitReport(
        wallet.client!,
        {
          title: title.trim(),
          description: description.trim(),
          evidenceUrl: evidenceUrl.trim(),
          bondWei: BigInt(Math.trunc(Number(bond))),
        },
        { onStatus }
      );
      return { hash: (receipt as { hash?: string })?.hash ?? "" };
    });
  }

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Submit a report</h1>
      <p className="mt-1.5 text-sm text-text-muted">
        Your bond is refunded if the report turns out valid or a duplicate. It
        goes to the bounty pool only if the report is judged invalid.
      </p>

      {program.status === "ready" && (
        <p className="mt-3 text-xs text-text-faint">
          Minimum bond for this program: {program.data.min_bond} wei · Pool
          balance: {program.data.pool_balance} wei
        </p>
      )}

      {tx.state.phase === "done" ? (
        <div className="mt-8 glass glow rounded-xl p-5 ring-1 ring-inset ring-success/25">
          <p className="font-medium text-success">Report submitted.</p>
          <p className="mt-1 text-sm text-text-muted">
            It&rsquo;s now visible to the maintainer and anyone browsing the
            program.
          </p>
          {tx.state.hash && (
            <a
              href={EXPLORER_TX_URL(tx.state.hash)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs underline decoration-dotted text-success"
            >
              View transaction ↗
            </a>
          )}
          <Link
            href="/reports"
            className="cyber-border mt-4 block rounded-md bg-gradient-to-r from-accent to-accent-2 text-accent-contrast px-4 py-2 text-sm font-medium text-center hover:brightness-110 transition-all"
          >
            View all reports
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="title" className="block text-sm font-medium">
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Auth bypass via crafted session token"
              className="mt-1.5 w-full rounded-md hairline bg-surface px-3 py-2 text-sm focus:ring-1 focus:ring-accent/50 outline-none"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Steps to reproduce, impact, affected files or endpoints."
              className="mt-1.5 w-full rounded-md hairline bg-surface px-3 py-2 text-sm resize-y focus:ring-1 focus:ring-accent/50 outline-none"
            />
          </div>

          <div>
            <label htmlFor="evidence" className="block text-sm font-medium">
              Evidence URL <span className="text-text-faint font-normal">(optional)</span>
            </label>
            <input
              id="evidence"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://gist.github.com/…"
              className="mt-1.5 w-full rounded-md hairline bg-surface px-3 py-2 text-sm focus:ring-1 focus:ring-accent/50 outline-none"
            />
            <p className="mt-1 text-xs text-text-faint">
              If disputed, the contract fetches this page itself as evidence.
            </p>
          </div>

          <div>
            <label htmlFor="bond" className="block text-sm font-medium">
              Bond (wei)
            </label>
            <input
              id="bond"
              type="number"
              min={minBond ?? 0}
              value={bond}
              onChange={(e) => setBond(e.target.value)}
              placeholder={minBond ? String(minBond) : "0"}
              className="mt-1.5 w-full rounded-md hairline bg-surface px-3 py-2 text-sm focus:ring-1 focus:ring-accent/50 outline-none"
            />
          </div>

          {validationError && (
            <p role="alert" className="text-sm text-danger">
              {validationError}
            </p>
          )}

          {tx.state.phase === "error" && (
            <p role="alert" className="text-sm text-danger">
              {tx.state.message}
            </p>
          )}

          {tx.state.phase === "running" && (
            <TxProgress
              status={tx.state.status}
              elapsedSeconds={tx.elapsed}
            />
          )}

          {!wallet.client ? (
            <p className="text-sm text-text-muted">
              Connect a wallet (top right) to submit a report.
            </p>
          ) : (
            <button
              type="submit"
              disabled={tx.state.phase === "running"}
              className="cyber-border w-full rounded-md bg-gradient-to-r from-accent to-accent-2 text-accent-contrast px-4 py-2.5 font-medium hover:brightness-110 transition-all disabled:opacity-40"
            >
              {tx.state.phase === "running" ? "Submitting…" : "Submit report"}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
