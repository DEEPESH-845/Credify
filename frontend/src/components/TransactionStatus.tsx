"use client";

export interface TransactionStatusProps {
  /** Status text to display alongside the spinner */
  message: string;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * An inline loading indicator for blockchain transactions.
 *
 * Displays a spinner and status text. Designed to be embedded
 * directly in forms and page sections during pending transactions.
 */
export default function TransactionStatus({
  message,
  className = "",
}: TransactionStatusProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"
        aria-label="Transaction pending"
      />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}
