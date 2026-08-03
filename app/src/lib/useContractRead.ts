"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet, getReadOnlyClient } from "./wallet";

type State<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: T };

/**
 * Reads use whichever identity is active (wallet or throwaway), refetch on demand.
 * A stable `deps` array controls when the read reruns.
 */
export function useContractRead<T>(
  fetcher: (client: ReturnType<typeof getReadOnlyClient>) => Promise<T>,
  deps: unknown[]
): State<T> & { refetch: () => void } {
  const wallet = useWallet();
  const [state, setState] = useState<State<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);

  const client = wallet.client ?? getReadOnlyClient();

  const run = useCallback(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetcher(client)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: "error",
            error: err instanceof Error ? err.message : "Failed to load.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, wallet.mode, ...deps]);

  useEffect(() => run(), [run]);

  return { ...state, refetch: () => setTick((t) => t + 1) };
}
