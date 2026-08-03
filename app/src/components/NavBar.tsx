"use client";

import Link from "next/link";
import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { WalletPanel } from "@/components/WalletPanel";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function NavBar() {
  const wallet = useWallet();
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <header className="hairline bg-surface/70 backdrop-blur-md sticky top-0 z-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        <Link href="/" className="font-semibold tracking-tight text-[1.05rem] shrink-0">
          <span className="gradient-text">Bounty</span>{" "}
          <span className="text-text">Verdict</span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6 text-sm text-text-muted min-w-0">
          <Link href="/reports" className="hover:text-accent transition-colors whitespace-nowrap">
            Reports
          </Link>
          <Link href="/submit" className="hover:text-accent transition-colors whitespace-nowrap">
            Submit
          </Link>
        </nav>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            aria-haspopup="dialog"
            className="cyber-border inline-flex items-center gap-2 rounded-md bg-surface-raised px-3 py-1.5 text-sm font-medium hover:bg-border/40 transition-colors"
          >
            {wallet.mode === "detecting" && (
              <span className="text-text-muted">Loading wallet…</span>
            )}
            {wallet.mode === "none" && <span>Connect wallet</span>}
            {wallet.mode === "injected" && wallet.address && (
              <>
                <span
                  className="h-2 w-2 rounded-full bg-success shadow-[0_0_6px_var(--success)]"
                  aria-hidden
                />
                <span className="font-mono">{short(wallet.address)}</span>
              </>
            )}
            {wallet.mode === "generated" && wallet.address && (
              <>
                <span
                  className="h-2 w-2 rounded-full bg-warning shadow-[0_0_6px_var(--warning)]"
                  aria-hidden
                />
                <span className="font-mono">{short(wallet.address)}</span>
              </>
            )}
          </button>
          {panelOpen && <WalletPanel onClose={() => setPanelOpen(false)} />}
        </div>
      </div>
    </header>
  );
}
