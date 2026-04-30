"use client";

import { useCallback, useEffect, useState } from "react";

export type ToastStatus = "loading" | "success" | "error";

export interface TransactionToastProps {
  /** Current status of the toast */
  status: ToastStatus;
  /** Message to display */
  message: string;
  /** Called when the user clicks the Retry button (error state only) */
  onRetry?: () => void;
  /** Called when the toast is dismissed */
  onDismiss?: () => void;
  /** Auto-dismiss delay in ms for success toasts. Defaults to 4000. Set to 0 to disable. */
  autoDismissMs?: number;
}

/**
 * A toast notification component for blockchain transaction feedback.
 *
 * Displays at the bottom-right of the screen with three states:
 * - loading: spinner + status text
 * - success: checkmark + message, auto-dismisses
 * - error: error icon + message + optional Retry button
 */
export default function TransactionToast({
  status,
  message,
  onRetry,
  onDismiss,
  autoDismissMs = 4000,
}: TransactionToastProps) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss success toasts
  useEffect(() => {
    if (status === "success" && autoDismissMs > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [status, autoDismissMs, onDismiss]);

  // Reset visibility when status changes
  useEffect(() => {
    setVisible(true);
  }, [status, message]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!visible) return null;

  const bgColor =
    status === "error"
      ? "bg-red-50 border-red-200"
      : status === "success"
        ? "bg-green-50 border-green-200"
        : "bg-white border-gray-200";

  const textColor =
    status === "error"
      ? "text-red-700"
      : status === "success"
        ? "text-green-700"
        : "text-gray-700";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg ${bgColor}`}
    >
      {/* Icon / Spinner */}
      <div className="flex-shrink-0 pt-0.5">
        {status === "loading" && (
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
            aria-label="Transaction pending"
          />
        )}
        {status === "success" && (
          <svg
            className="h-5 w-5 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
        {status === "error" && (
          <svg
            className="h-5 w-5 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
            />
          </svg>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${textColor}`}>{message}</p>
        {status === "error" && onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-sm font-medium text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        )}
      </div>

      {/* Dismiss button */}
      {status !== "loading" && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          aria-label="Dismiss notification"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
