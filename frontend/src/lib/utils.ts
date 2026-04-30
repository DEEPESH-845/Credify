/**
 * Truncate an Ethereum address to 0x1234…abcd format.
 * Returns first 6 chars + "…" + last 4 chars.
 * If address is falsy or less than 10 chars, returns it as-is.
 */
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
