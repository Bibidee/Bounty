"use client";

import {
  createClient,
  createAccount,
  generatePrivateKey,
} from "genlayer-js";
import type { GenLayerClient } from "genlayer-js/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { chain, WALLET_ACK_STORAGE_KEY, WALLET_STORAGE_KEY } from "./config";

type WalletMode = "detecting" | "injected" | "generated" | "none";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

interface WalletState {
  mode: WalletMode;
  address: `0x${string}` | null;
  /** Same identity used for both reads and writes once a wallet is active. */
  client: GenLayerClient<typeof chain> | null;
  injectedAvailable: boolean;
  hasStoredGeneratedWallet: boolean;
  hasAcknowledgedGeneratedWalletWarning: boolean;
  connectInjected: () => Promise<void>;
  generateNewWallet: (acknowledged: boolean) => void;
  importGeneratedWallet: (privateKey: string, acknowledged: boolean) => void;
  exportGeneratedPrivateKey: () => string | null;
}

const WalletContext = createContext<WalletState | null>(null);

function readStoredKey(): `0x${string}` | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(WALLET_STORAGE_KEY);
  if (!raw) return null;
  return raw as `0x${string}`;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<WalletMode>("detecting");
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [client, setClient] = useState<GenLayerClient<typeof chain> | null>(null);
  const [injectedAvailable, setInjectedAvailable] = useState(false);
  const [hasStoredGeneratedWallet, setHasStoredGeneratedWallet] = useState(false);
  const [hasAcknowledgedGeneratedWalletWarning, setHasAcknowledgedGeneratedWalletWarning] =
    useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setInjectedAvailable(Boolean(window.ethereum));
    setHasStoredGeneratedWallet(Boolean(readStoredKey()));
    setHasAcknowledgedGeneratedWalletWarning(
      window.localStorage.getItem(WALLET_ACK_STORAGE_KEY) === "true"
    );

    const storedKey = readStoredKey();
    if (storedKey) {
      const account = createAccount(storedKey);
      setClient(createClient({ chain, account }));
      setAddress(account.address as `0x${string}`);
      setMode("generated");
    } else {
      setMode(window.ethereum ? "none" : "none");
    }
  }, []);

  const connectInjected = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("No injected wallet detected.");
    }
    const accounts = (await window.ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];
    const walletAddress = accounts[0] as `0x${string}` | undefined;
    if (!walletAddress) {
      throw new Error("No account returned by the injected wallet.");
    }
    // Plain injected-wallet signing: the client falls back to
    // window.ethereum for personal_sign / eth_sendTransaction whenever
    // account is a bare address. No MetaMask Snap step required.
    const injectedClient = createClient({
      chain,
      account: walletAddress,
      provider: window.ethereum,
    }) as GenLayerClient<typeof chain>;
    setClient(injectedClient);
    setAddress(walletAddress);
    setMode("injected");
  }, []);

  const generateNewWallet = useCallback((acknowledged: boolean) => {
    if (!acknowledged) {
      throw new Error("Generated-wallet warning must be acknowledged first.");
    }
    if (typeof window === "undefined") return;
    const privateKey = generatePrivateKey();
    window.localStorage.setItem(WALLET_STORAGE_KEY, privateKey);
    window.localStorage.setItem(WALLET_ACK_STORAGE_KEY, "true");
    const account = createAccount(privateKey);
    setClient(createClient({ chain, account }));
    setAddress(account.address as `0x${string}`);
    setMode("generated");
    setHasStoredGeneratedWallet(true);
    setHasAcknowledgedGeneratedWalletWarning(true);
  }, []);

  const importGeneratedWallet = useCallback(
    (privateKey: string, acknowledged: boolean) => {
      if (!acknowledged) {
        throw new Error("Generated-wallet warning must be acknowledged first.");
      }
      if (typeof window === "undefined") return;
      const normalized = privateKey.startsWith("0x")
        ? (privateKey as `0x${string}`)
        : (`0x${privateKey}` as `0x${string}`);
      const account = createAccount(normalized);
      window.localStorage.setItem(WALLET_STORAGE_KEY, normalized);
      window.localStorage.setItem(WALLET_ACK_STORAGE_KEY, "true");
      setClient(createClient({ chain, account }));
      setAddress(account.address as `0x${string}`);
      setMode("generated");
      setHasStoredGeneratedWallet(true);
      setHasAcknowledgedGeneratedWalletWarning(true);
    },
    []
  );

  const exportGeneratedPrivateKey = useCallback(() => {
    return readStoredKey();
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      mode,
      address,
      client,
      injectedAvailable,
      hasStoredGeneratedWallet,
      hasAcknowledgedGeneratedWalletWarning,
      connectInjected,
      generateNewWallet,
      importGeneratedWallet,
      exportGeneratedPrivateKey,
    }),
    [
      mode,
      address,
      client,
      injectedAvailable,
      hasStoredGeneratedWallet,
      hasAcknowledgedGeneratedWalletWarning,
      connectInjected,
      generateNewWallet,
      importGeneratedWallet,
      exportGeneratedPrivateKey,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

let throwawayReadClient: GenLayerClient<typeof chain> | null = null;

/** A read-only client for browsing without a wallet. Views need no signature. */
export function getReadOnlyClient(): GenLayerClient<typeof chain> {
  if (!throwawayReadClient) {
    throwawayReadClient = createClient({ chain, account: createAccount() });
  }
  return throwawayReadClient;
}
