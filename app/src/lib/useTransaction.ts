"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TransactionStatus } from "genlayer-js/types";

type TxState =
  | { phase: "idle" }
  | { phase: "running"; status: TransactionStatus | null; hash?: string; startedAt: number }
  | { phase: "done"; hash: string }
  | { phase: "error"; message: string };

export function useTransaction() {
  const [state, setState] = useState<TxState>({ phase: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.phase !== "running") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - state.startedAt) / 1000));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state]);

  const run = useCallback(
    async (fn: (onStatus: (s: TransactionStatus) => void) => Promise<{ hash?: string }>) => {
      const startedAt = Date.now();
      setState({ phase: "running", status: TransactionStatus.PENDING, startedAt });
      setElapsed(0);
      try {
        const result = await fn((status) => {
          setState((prev) =>
            prev.phase === "running" ? { ...prev, status } : prev
          );
        });
        setState({ phase: "done", hash: result.hash ?? "" });
      } catch (e) {
        setState({
          phase: "error",
          message: e instanceof Error ? e.message : "Transaction failed.",
        });
      }
    },
    []
  );

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  return { state, elapsed, run, reset };
}
