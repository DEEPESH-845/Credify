"use client";

import { useCallback, useRef, useState } from "react";
import { parseTransactionError } from "@/lib/transaction-utils";
import { useTransactionToast } from "@/contexts/TransactionContext";

export type TransactionStep = "idle" | "pending" | "confirming" | "success" | "error";

export interface UseTransactionOptions {
  /** Message shown while the transaction is being submitted */
  pendingMessage?: string;
  /** Message shown while waiting for on-chain confirmation */
  confirmingMessage?: string;
  /** Message shown on success */
  successMessage?: string;
  /** Whether to show toast notifications (default: true) */
  showToast?: boolean;
}

export interface UseTransactionReturn<T> {
  /** Current step of the transaction lifecycle */
  step: TransactionStep;
  /** Parsed error message if the transaction failed */
  error: string | null;
  /** Whether a transaction is currently in progress */
  isLoading: boolean;
  /** The result of the last successful transaction */
  result: T | null;
  /** Execute a transaction. The callback receives no args and should return a promise. */
  execute: (fn: () => Promise<T>) => Promise<T | null>;
  /** Reset the hook state back to idle */
  reset: () => void;
}

/**
 * Hook for managing blockchain transaction lifecycle with loading indicators
 * and toast notifications.
 *
 * Wraps any async transaction function with:
 * - Step tracking (idle → pending → confirming → success/error)
 * - Automatic revert reason parsing via parseTransactionError
 * - Toast notifications for network errors with retry option
 * - Inline status via the returned step and error values
 */
export function useTransaction<T = unknown>(
  options: UseTransactionOptions = {}
): UseTransactionReturn<T> {
  const {
    pendingMessage = "Submitting transaction...",
    confirmingMessage = "Waiting for confirmation...",
    successMessage = "Transaction confirmed!",
    showToast = true,
  } = options;

  const [step, setStep] = useState<TransactionStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);

  const toast = useTransactionToast();
  const toastIdRef = useRef<string | null>(null);
  const lastFnRef = useRef<(() => Promise<T>) | null>(null);

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setResult(null);
    if (toastIdRef.current && showToast) {
      toast.dismissToast(toastIdRef.current);
      toastIdRef.current = null;
    }
  }, [toast, showToast]);

  const execute = useCallback(
    async (fn: () => Promise<T>): Promise<T | null> => {
      lastFnRef.current = fn;
      setError(null);
      setResult(null);
      setStep("pending");

      if (showToast) {
        toastIdRef.current = toast.showLoading(pendingMessage);
      }

      try {
        const txResult = await fn();

        setStep("success");
        setResult(txResult);

        if (showToast && toastIdRef.current) {
          toast.updateToast(toastIdRef.current, "success", successMessage);
        }

        return txResult;
      } catch (err: unknown) {
        const parsed = parseTransactionError(err);
        setError(parsed);
        setStep("error");

        // Determine if this is a network error that warrants a retry button
        const isNetworkError =
          err instanceof Error &&
          (("code" in err &&
            ((err as { code: string }).code === "NETWORK_ERROR" ||
              (err as { code: string }).code === "SERVER_ERROR")) ||
            err.message.toLowerCase().includes("network error") ||
            err.message.toLowerCase().includes("server error") ||
            err.message.toLowerCase().includes("failed to fetch"));

        if (showToast && toastIdRef.current) {
          const retryFn = isNetworkError
            ? () => {
                if (lastFnRef.current) {
                  execute(lastFnRef.current);
                }
              }
            : undefined;

          toast.updateToast(
            toastIdRef.current,
            "error",
            parsed,
            retryFn
          );
        }

        return null;
      }
    },
    [toast, showToast, pendingMessage, successMessage]
  );

  const isLoading = step === "pending" || step === "confirming";

  return { step, error, isLoading, result, execute, reset };
}
