import Link from "next/link";
import { CONTRACT_ADDRESS, EXPLORER_ADDRESS_URL } from "@/lib/config";

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24">
      <p className="text-sm font-medium text-accent mb-3 tracking-wide uppercase">
        Bug bounty escrow
      </p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.15] max-w-xl">
        Nobody has to <span className="gradient-text">trust the maintainer</span> to
        pay out a valid report.
      </h1>
      <p className="mt-5 text-lg text-text-muted max-w-xl leading-relaxed">
        A researcher stakes GEN and submits a vulnerability report. If the
        maintainer disputes it, the contract itself fetches the repository&rsquo;s
        issue history and judges validity and novelty — not a single party with
        an incentive to say no.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/submit"
          className="cyber-border rounded-md bg-gradient-to-r from-accent to-accent-2 text-accent-contrast px-4 py-2.5 font-medium hover:brightness-110 transition-all glow"
        >
          Submit a report
        </Link>
        <Link
          href="/reports"
          className="hairline rounded-md px-4 py-2.5 font-medium hover:bg-surface transition-colors"
        >
          Browse reports
        </Link>
      </div>

      <div className="mt-16 grid sm:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-5">
          <span className="text-xs font-mono text-accent">01</span>
          <h2 className="font-medium mt-1">Stake and report</h2>
          <p className="mt-1.5 text-sm text-text-muted leading-relaxed">
            Post a GEN bond with your report. The maintainer can accept it
            outright, or dispute it.
          </p>
        </div>
        <div className="glass rounded-xl p-5">
          <span className="text-xs font-mono text-accent">02</span>
          <h2 className="font-medium mt-1">Disputed reports go to consensus</h2>
          <p className="mt-1.5 text-sm text-text-muted leading-relaxed">
            Anyone can trigger resolution. The contract fetches the repo&rsquo;s
            real issues and judges novelty and validity through GenLayer
            consensus, banded into a clear verdict.
          </p>
        </div>
        <div className="glass rounded-xl p-5">
          <span className="text-xs font-mono text-accent">03</span>
          <h2 className="font-medium mt-1">Funds settle automatically</h2>
          <p className="mt-1.5 text-sm text-text-muted leading-relaxed">
            Valid reports are paid from the bounty pool. Duplicates return
            your bond. Invalid reports forfeit the bond to the pool.
          </p>
        </div>
      </div>

      <div className="mt-16 glass rounded-xl p-5">
        <h2 className="text-sm font-medium text-text-muted tracking-wide uppercase">
          Why this needs consensus
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          Delete GenLayer from this picture and one party — the maintainer, who
          is financially motivated to reject reports — decides validity alone.
          That is exactly the failure mode real bounty programs run into.
          Judging whether a report is novel and genuinely in scope requires
          reading prose and evidence, not evaluating a formula.
        </p>
        <p className="mt-4 text-xs text-text-faint font-mono">
          Contract:{" "}
          <a
            href={EXPLORER_ADDRESS_URL(CONTRACT_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline decoration-dotted hover:text-accent-hover"
          >
            {CONTRACT_ADDRESS}
          </a>
        </p>
      </div>
    </div>
  );
}
