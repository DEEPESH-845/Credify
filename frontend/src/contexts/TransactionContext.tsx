"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import TransactionToast, {
  ToastStatus,
} from "@/components/TransactionToast";

export interface Toast {
  id: string;
  status: ToastStatus;
  message: string;
  onRetry?: () => void;
}

export interface TransactionContextValue {
  /** Show a loading toast. Returns the toast id for later updates. */
  showLoading: (message: string) => string;
  /** Show a success toast. Returns the toast id. */
  showSuccess: (message: string) => string;
  /** Show an error toast with optional retry callback. Returns the toast id. */
  showError: (message: string, onRetry?: () => void) => string;
  /** Update an existing toast by id. */
  updateToast: (
    id: string,
    status: ToastStatus,
    message: string,
    onRetry?: () => void
  ) => void;
  /** Dismiss a toast by id. */
  dismissToast: (id: string) => void;
  /** Dismiss all toasts. */
  dismissAll: () => void;
}

const TransactionContext = createContext<TransactionContextValue>({
  showLoading: () => "",
  showSuccess: () => "",
  showError: () => "",
  updateToast: () => {},
  dismissToast: () => {},
  dismissAll: () => {},
});

export function useTransactionToast(): TransactionContextValue {
  return useContext(TransactionContext);
}

let nextToastId = 0;
function generateToastId(): string {
  nextToastId += 1;
  return `toast-${nextToastId}-${Date.now()}`;
}

export function TransactionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const showLoading = useCallback((message: string): string => {
    const id = generateToastId();
    setToasts((prev) => [...prev, { id, status: "loading", message }]);
    return id;
  }, []);

  const showSuccess = useCallback((message: string): string => {
    const id = generateToastId();
    setToasts((prev) => [...prev, { id, status: "success", message }]);
    return id;
  }, []);

  const showError = useCallback(
    (message: string, onRetry?: () => void): string => {
      const id = generateToastId();
      setToasts((prev) => [
        ...prev,
        { id, status: "error", message, onRetry },
      ]);
      return id;
    },
    []
  );

  const updateToast = useCallback(
    (
      id: string,
      status: ToastStatus,
      message: string,
      onRetry?: () => void
    ) => {
      setToasts((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status, message, onRetry } : t
        )
      );
    },
    []
  );

  const value = useMemo<TransactionContextValue>(
    () => ({
      showLoading,
      showSuccess,
      showError,
      updateToast,
      dismissToast,
      dismissAll,
    }),
    [showLoading, showSuccess, showError, updateToast, dismissToast, dismissAll]
  );

  return (
    <TransactionContext.Provider value={value}>
      {children}
      {/* Render toast stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2">
        {toasts.map((toast) => (
          <TransactionToast
            key={toast.id}
            status={toast.status}
            message={toast.message}
            onRetry={toast.onRetry}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </TransactionContext.Provider>
  );
}
