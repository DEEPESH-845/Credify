"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/contexts/WalletContext";
import {
  getConnections,
  getPendingConnections,
  sendConnectionRequest,
  acceptConnection,
  declineConnection,
  searchUsers,
  ConnectionData,
  ProfileData,
  ApiRequestError,
} from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import PageLayout from "@/components/PageLayout";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { truncateAddress } from "@/lib/utils";

function ConnectionsContent() {
  const { address, jwt } = useWallet();

  // Accepted connections state
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pending requests state
  const [pendingRequests, setPendingRequests] = useState<ConnectionData[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  // Send request state
  const [recipientAddress, setRecipientAddress] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Action loading state (for accept/decline buttons)
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Discover people state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileData[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTotal, setSearchTotal] = useState(0);
  const [requestedAddresses, setRequestedAddresses] = useState<Set<string>>(new Set());
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);

  // Fetch accepted connections
  const fetchConnections = useCallback(async () => {
    if (!jwt) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getConnections(jwt, page, limit);
      setConnections(result.connections);
      setTotal(result.total);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("Failed to load connections");
      }
    } finally {
      setLoading(false);
    }
  }, [jwt, page, limit]);

  // Fetch pending requests
  const fetchPendingRequests = useCallback(async () => {
    if (!jwt) return;
    setPendingLoading(true);
    try {
      const result = await getPendingConnections(jwt);
      setPendingRequests(result.connections);
    } catch {
      // Silently handle — pending section is supplementary
      setPendingRequests([]);
    } finally {
      setPendingLoading(false);
    }
  }, [jwt]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  // Debounced search
  useEffect(() => {
    if (!jwt || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchTotal(0);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const result = await searchUsers(searchQuery.trim(), jwt);
        setSearchResults(result.users);
        setSearchTotal(result.total);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, jwt]);

  // Send connection request
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jwt || !recipientAddress.trim()) return;

    setSendLoading(true);
    setSendError(null);
    setSendSuccess(null);

    try {
      await sendConnectionRequest(recipientAddress.trim(), jwt);
      setSendSuccess(`Connection request sent to ${recipientAddress.trim()}`);
      setRecipientAddress("");
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setSendError(err.message);
      } else {
        setSendError("Failed to send connection request");
      }
    } finally {
      setSendLoading(false);
    }
  };

  // Accept a pending request
  const handleAccept = async (connectionId: number) => {
    if (!jwt) return;
    setActionLoading(connectionId);
    try {
      await acceptConnection(connectionId, jwt);
      setPendingRequests((prev) => prev.filter((c) => c.id !== connectionId));
      // Refresh accepted connections
      await fetchConnections();
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("Failed to accept connection request");
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Decline a pending request
  const handleDecline = async (connectionId: number) => {
    if (!jwt) return;
    setActionLoading(connectionId);
    try {
      await declineConnection(connectionId, jwt);
      setPendingRequests((prev) => prev.filter((c) => c.id !== connectionId));
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("Failed to decline connection request");
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Connect from discover section
  const handleConnect = async (recipientAddr: string) => {
    if (!jwt) return;
    setConnectingAddress(recipientAddr);
    try {
      await sendConnectionRequest(recipientAddr, jwt);
      setRequestedAddresses((prev) => new Set(prev).add(recipientAddr.toLowerCase()));
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setSendError(err.message);
      } else {
        setSendError("Failed to send connection request");
      }
    } finally {
      setConnectingAddress(null);
    }
  };

  // Build set of addresses that are already connected or pending
  const connectedAddresses = useMemo(() => {
    const set = new Set<string>();
    for (const conn of connections) {
      const addr = conn.profile?.wallet_address || conn.requester_address;
      set.add(addr.toLowerCase());
    }
    for (const conn of pendingRequests) {
      set.add(conn.requester_address.toLowerCase());
    }
    return set;
  }, [connections, pendingRequests]);

  const totalPages = Math.ceil(total / limit);

  /**
   * Get the display name for a connection, falling back to truncated address.
   */
  const getDisplayName = (conn: ConnectionData): string => {
    if (conn.profile?.display_name) return conn.profile.display_name;
    return truncateAddress(conn.profile?.wallet_address || conn.requester_address);
  };

  /**
   * Get the alt text for a connection's profile image.
   */
  const getProfileAlt = (conn: ConnectionData): string => {
    const identifier = conn.profile?.display_name || truncateAddress(conn.profile?.wallet_address || conn.requester_address);
    return `${identifier} profile photo`;
  };

  return (
    <>
      <h1 className="mb-6 text-3xl font-bold text-neutral-50">Connections</h1>

      {/* Discover People */}
      <section className="mb-8 rounded-xl bg-neutral-900/80 border border-white/[0.06] p-6 backdrop-blur-sm shadow-card">
        <h2 className="mb-4 text-xl font-semibold text-neutral-50">
          Discover People
        </h2>
        <div className="mb-4">
          <label htmlFor="search-users" className="sr-only">Search users</label>
          <input
            id="search-users"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or wallet address..."
            className="w-full rounded-lg border border-white/[0.06] bg-neutral-900/50 px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          />
        </div>

        {searchLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            ))}
          </div>
        )}

        {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
          <p className="text-sm text-neutral-500 text-center py-4">
            No users found matching &ldquo;{searchQuery}&rdquo;
          </p>
        )}

        {!searchLoading && searchResults.length > 0 && (
          <ul className="divide-y divide-white/[0.06]">
            {searchResults.map((user) => {
              const userAddr = user.wallet_address.toLowerCase();
              const isConnected = connectedAddresses.has(userAddr);
              const isRequested = requestedAddresses.has(userAddr);
              const isConnecting = connectingAddress === user.wallet_address;
              const isSelf = address?.toLowerCase() === userAddr;

              return (
                <li key={user.wallet_address} className="flex items-center justify-between py-3">
                  <Link
                    href={`/profile/${user.wallet_address}`}
                    className="flex items-center gap-3 min-w-0 flex-1 rounded-md hover:bg-neutral-800/50 -mx-2 px-2 py-1 transition-colors"
                  >
                    {user.profile_image_cid ? (
                      <img
                        src={`${process.env.NEXT_PUBLIC_IPFS_GATEWAY}/${user.profile_image_cid}`}
                        alt={`${user.display_name || truncateAddress(user.wallet_address)} profile photo`}
                        className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-neutral-500 flex-shrink-0">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-100 truncate">
                        {user.display_name || "Unnamed User"}
                      </p>
                      {user.headline && (
                        <p className="text-xs text-neutral-500 truncate">{user.headline}</p>
                      )}
                      <p className="text-xs text-neutral-600 font-mono truncate">{truncateAddress(user.wallet_address)}</p>
                    </div>
                  </Link>

                  {!isSelf && (
                    <div className="ml-3 flex-shrink-0">
                      {isConnected ? (
                        <span className="inline-flex items-center rounded-md bg-success-500/10 border border-success-500/20 px-3 py-1.5 text-xs font-medium text-success-400">
                          Connected
                        </span>
                      ) : isRequested ? (
                        <span className="inline-flex items-center rounded-md bg-neutral-800 border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-neutral-400">
                          Requested
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleConnect(user.wallet_address);
                          }}
                          disabled={isConnecting}
                          className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isConnecting ? "Sending..." : "Connect"}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!searchLoading && searchQuery.trim().length < 2 && (
          <p className="text-sm text-neutral-500 text-center py-4">
            Type at least 2 characters to search for people
          </p>
        )}
      </section>

      {/* Send Connection Request */}
      <section className="mb-8 rounded-xl bg-neutral-900/80 border border-white/[0.06] p-6 backdrop-blur-sm shadow-card">
        <h2 className="mb-4 text-xl font-semibold text-neutral-50">
          Send Connection Request
        </h2>
        <form onSubmit={handleSendRequest} className="flex gap-3">
          <label htmlFor="recipient-address" className="sr-only">
            Wallet address
          </label>
          <input
            id="recipient-address"
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="Enter wallet address (0x...)"
            className="flex-1 rounded-lg border border-white/[0.06] bg-neutral-900/50 px-4 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            disabled={sendLoading}
          />
          <button
            type="submit"
            disabled={sendLoading || !recipientAddress.trim()}
            className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sendLoading ? "Sending..." : "Send Request"}
          </button>
        </form>
        {sendSuccess && (
          <p className="mt-3 text-sm text-success-400" role="status">
            {sendSuccess}
          </p>
        )}
        {sendError && (
          <p className="mt-3 text-sm text-error-400" role="alert">
            {sendError}
          </p>
        )}
      </section>

      {/* Pending Requests */}
      {!pendingLoading && pendingRequests.length > 0 && (
        <section className="mb-8 rounded-xl bg-neutral-900/80 border border-white/[0.06] p-6 backdrop-blur-sm shadow-card">
          <h2 className="mb-4 text-xl font-semibold text-neutral-50">
            Pending Requests
          </h2>
          <ul className="divide-y divide-white/[0.06]" role="list">
            {pendingRequests.map((conn) => (
              <li
                key={conn.id}
                className="flex items-center justify-between py-4"
              >
                <div className="flex items-center gap-3">
                  {conn.profile?.profile_image_cid ? (
                    <img
                      src={`https://ipfs.io/ipfs/${conn.profile.profile_image_cid}`}
                      alt={getProfileAlt(conn)}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-neutral-500"
                      aria-label="Default avatar"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                  <div>
                    <Link
                      href={`/profile/${conn.requester_address}`}
                      className="text-sm font-medium text-primary-400 hover:text-primary-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 rounded"
                    >
                      {getDisplayName(conn)}
                    </Link>
                    {conn.profile?.headline && (
                      <p className="text-xs text-neutral-500">
                        {conn.profile.headline}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500">
                      {conn.requester_address}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(conn.id)}
                    disabled={actionLoading === conn.id}
                    className="rounded-md bg-success-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-success-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDecline(conn.id)}
                    disabled={actionLoading === conn.id}
                    className="rounded-md bg-error-600/80 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-error-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Error display */}
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-error-500/20 bg-error-500/10 p-4 text-sm text-error-300"
        >
          {error}
        </div>
      )}

      {/* Accepted Connections */}
      <section className="rounded-xl bg-neutral-900/80 border border-white/[0.06] p-6 backdrop-blur-sm shadow-card">
        <h2 className="mb-4 text-xl font-semibold text-neutral-50">
          My Connections
        </h2>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-28 mb-1" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : connections.length === 0 ? (
          <EmptyState message="No connections yet." action={{ label: "Find people", href: "#search-users" }} />
        ) : (
          <>
            <ul className="divide-y divide-white/[0.06]" role="list">
              {connections.map((conn) => {
                const connAddress = conn.profile?.wallet_address || conn.requester_address;
                return (
                  <li key={conn.id} className="py-4">
                    <Link
                      href={`/profile/${connAddress}`}
                      className="flex items-center gap-3 rounded-md -mx-2 px-2 py-1 hover:bg-neutral-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                    >
                      {conn.profile?.profile_image_cid ? (
                        <img
                          src={`https://ipfs.io/ipfs/${conn.profile.profile_image_cid}`}
                          alt={getProfileAlt(conn)}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-neutral-500"
                          aria-label="Default avatar"
                        >
                          <svg
                            className="h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary-400">
                          {getDisplayName(conn)}
                        </p>
                        {conn.profile?.headline && (
                          <p className="truncate text-xs text-neutral-500">
                            {conn.profile.headline}
                          </p>
                        )}
                        <p className="text-xs text-neutral-500">
                          {connAddress}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-white/[0.06] px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-800/80 hover:border-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-neutral-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page >= totalPages}
                  className="rounded-md border border-white/[0.06] px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-800/80 hover:border-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

export default function ConnectionsPage() {
  return (
    <AuthGuard>
      <PageLayout>
        <ConnectionsContent />
      </PageLayout>
    </AuthGuard>
  );
}
