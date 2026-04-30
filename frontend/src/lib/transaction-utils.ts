/**
 * Parse a human-readable error message from blockchain transaction errors.
 *
 * Handles ethers.js v6 error formats including:
 * - User rejection (MetaMask code 4001 / ethers ACTION_REJECTED)
 * - Contract revert reasons
 * - Network and provider errors
 * - Generic fallback for unknown errors
 */
export function parseTransactionError(err: unknown): string {
  if (!(err instanceof Error)) {
    return "An unexpected error occurred during the transaction.";
  }

  const errorWithCode = err as Error & { code?: string | number };

  // User rejected the transaction in their wallet
  if (
    errorWithCode.code === 4001 ||
    errorWithCode.code === "ACTION_REJECTED"
  ) {
    return "Transaction was rejected in your wallet.";
  }

  const message = err.message;

  // ethers.js v6 wraps revert reasons in reason="..." format
  const reasonMatch = message.match(/reason="([^"]+)"/);
  if (reasonMatch) {
    return reasonMatch[1];
  }

  // Some providers include the revert string directly
  const revertStringMatch = message.match(
    /reverted with reason string '([^']+)'/
  );
  if (revertStringMatch) {
    return revertStringMatch[1];
  }

  // ethers.js v6 custom error format
  const customErrorMatch = message.match(
    /execution reverted: "?([^"]+)"?/
  );
  if (customErrorMatch) {
    return customErrorMatch[1];
  }

  // Network / server errors
  if (
    errorWithCode.code === "NETWORK_ERROR" ||
    message.toLowerCase().includes("network error")
  ) {
    return "Network error. Please check your connection and try again.";
  }

  if (
    errorWithCode.code === "SERVER_ERROR" ||
    message.toLowerCase().includes("server error")
  ) {
    return "Server error. Please try again later.";
  }

  // Nonce too low (transaction already mined)
  if (
    errorWithCode.code === "NONCE_EXPIRED" ||
    message.toLowerCase().includes("nonce")
  ) {
    return "Transaction nonce conflict. Please try again.";
  }

  // Insufficient funds
  if (
    errorWithCode.code === "INSUFFICIENT_FUNDS" ||
    message.toLowerCase().includes("insufficient funds")
  ) {
    return "Insufficient funds to complete this transaction.";
  }

  // Return the raw message if it's reasonably short, otherwise a generic message
  if (message.length <= 200) {
    return message;
  }

  return "An unexpected error occurred during the transaction.";
}
