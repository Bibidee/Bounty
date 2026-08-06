"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/lib/wallet";

function short(addr: string) {
  return `${addr.slice(0, 10)}…${addr.slice(-8)}`;
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return "Failed to connect wallet.";
}

export function WalletPanel({ onClose }: { onClose: () => void }) {
  const wallet = useWallet();
  const ref = useRef<HTMLDivElement>(null);
  const [ack, setAck] = useState(false);
  const [importValue, setImportValue] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  async function handleConnectInjected() {
    setError(null);
    try {
      await wallet.connectInjected();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function handleGenerate() {
    setError(null);
    try {
      wallet.generateNewWallet(ack);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function handleImport() {
    setError(null);
    try {
      wallet.importGeneratedWallet(importValue.trim(), ack);
      setImportValue("");
      setShowImport(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const exportedKey = showExport ? wallet.exportGeneratedPrivateKey() : null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Wallet"
      className="glass glow absolute right-0 mt-2 w-80 rounded-xl p-4 text-sm"
    >
      {wallet.mode === "injected" && wallet.address && (
        <div className="space-y-3">
          <div>
            <p className="text-text-muted">Connected with your injected wallet.</p>
            <p className="font-mono break-all mt-1">{wallet.address}</p>
            <p className="text-xs text-text-faint mt-1">
              Reads and writes both use this address.
            </p>
          </div>
          <button
            type="button"
            onClick={wallet.disconnect}
            className="w-full rounded-md border border-danger/40 text-danger px-3 py-1.5 hover:bg-danger-bg transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}

      {wallet.mode === "generated" && wallet.address && (
        <div className="space-y-3">
          <div>
            <p className="text-text-muted">Using a browser-generated wallet.</p>
            <p className="font-mono break-all mt-1">{wallet.address}</p>
          </div>
          {wallet.injectedAvailable && (
            <button
              type="button"
              onClick={handleConnectInjected}
              className="w-full rounded-md border border-border px-3 py-1.5 text-left hover:bg-bg transition-colors"
            >
              Upgrade to injected wallet
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowExport((v) => !v)}
              className="flex-1 rounded-md border border-border px-3 py-1.5 hover:bg-bg transition-colors"
            >
              Export key
            </button>
          </div>
          {showExport && exportedKey && (
            <div className="rounded-md bg-warning-bg border border-warning/30 p-2 space-y-2">
              <p className="text-xs text-warning">
                Anyone with this key can act as you. Store it somewhere safe.
              </p>
              <code className="block break-all text-xs">{exportedKey}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(exportedKey);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="text-xs underline decoration-dotted"
              >
                {copied ? "Copied" : "Copy to clipboard"}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={wallet.disconnect}
            className="w-full rounded-md border border-danger/40 text-danger px-3 py-1.5 hover:bg-danger-bg transition-colors"
          >
            Disconnect
          </button>
          <p className="text-xs text-text-faint">
            Your key stays saved in this browser — reopening the wallet menu
            will offer it again.
          </p>
        </div>
      )}

      {wallet.mode === "none" && (
        <div className="space-y-4">
          {wallet.injectedAvailable && (
            <button
              type="button"
              onClick={handleConnectInjected}
              className="w-full rounded-md bg-gradient-to-r from-accent to-accent-2 text-accent-contrast px-3 py-2 font-medium hover:brightness-110 transition-all"
            >
              Connect injected wallet
            </button>
          )}

          {wallet.hasStoredGeneratedWallet ? (
            <button
              type="button"
              onClick={wallet.reconnectStoredWallet}
              className="w-full rounded-md border border-border px-3 py-1.5 font-medium hover:bg-bg transition-colors"
            >
              Reconnect saved browser wallet
            </button>
          ) : (
            !wallet.injectedAvailable && (
              <p className="text-text-muted text-xs">
                No injected wallet (like MetaMask) detected. You can generate
                a wallet that lives in this browser instead.
              </p>
            )
          )}

          {!wallet.hasStoredGeneratedWallet && (
            <div className="border-t border-border pt-3 space-y-2">
              <label className="flex items-start gap-2 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I understand this key will live only in this browser.
                  Clearing site data destroys it. This is not custody-grade —
                  export a backup if the amount matters.
                </span>
              </label>
              <button
                type="button"
                disabled={!ack}
                onClick={handleGenerate}
                className="w-full rounded-md border border-border px-3 py-1.5 font-medium enabled:hover:bg-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generate a new browser wallet
              </button>
              <button
                type="button"
                onClick={() => setShowImport((v) => !v)}
                className="w-full text-xs text-text-muted underline decoration-dotted"
              >
                or import an existing key
              </button>
              {showImport && (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={importValue}
                    onChange={(e) => setImportValue(e.target.value)}
                    placeholder="0x…"
                    className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs font-mono"
                  />
                  <button
                    type="button"
                    disabled={!ack || !importValue.trim()}
                    onClick={handleImport}
                    className="w-full rounded-md border border-border px-3 py-1.5 text-xs font-medium enabled:hover:bg-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Import key
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
