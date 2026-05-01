"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/contexts/WalletContext";
import {
  getConnections,
  getPendingConnections,
  sendConnectionRequest,
  acceptConnection,
  declineConnection,
  ConnectionData,
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
      <h1 className="mb-6 text-3xl font-bold text-neutral-900">Connections</h1>

      {/* Send Connection Request */}
      <section className="mb-8 rounded-lg bg-white p-6 shadow-card">
        <h2 className="mb-4 text-xl font-semibold text-neutral-800">
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
            className="flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            disabled={sendLoading}
          />
          <button
            type="submit"
            disabled={sendLoading || !recipientAddress.trim()}
            className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sendLoading ? "Sending..." : "Send Request"}
          </button>
        </form>
        {sendSuccess && (
          <p className="mt-3 text-sm text-success-600" role="status">
            {sendSuccess}
          </p>
        )}
        {sendError && (
          <p className="mt-3 text-sm text-error-600" role="alert">
            {sendError}
          </p>
        )}
      </section>

      {/* Pending Requests */}
      {!pendingLoading && pendingRequests.length > 0 && (
        <section className="mb-8 rounded-lg bg-white p-6 shadow-card">
          <h2 className="mb-4 text-xl font-semibold text-neutral-800">
            Pending Requests
          </h2>
          <ul className="divide-y divide-neutral-200" role="list">
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
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-neutral-400"
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
                      className="text-sm font-medium text-primary-700 hover:text-primary-800 hover:underline"
                    >
                      {getDisplayName(conn)}
                    </Link>
                    {conn.profile?.headline && (
                      <p className="text-xs text-neutral-400">
                        {conn.profile.headline}
                      </p>
                    )}
                    <p className="text-xs text-neutral-400">
                      {conn.requester_address}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(conn.id)}
                    disabled={actionLoading === conn.id}
                    className="rounded-md bg-success-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-success-700 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDecline(conn.id)}
                    disabled={actionLoading === conn.id}
                    className="rounded-md bg-error-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-error-700 disabled:opacity-50"
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
          className="mb-6 rounded-md border border-error-100 bg-error-50 p-4 text-sm text-error-700"
        >
          {error}
        </div>
      )}

      {/* Accepted Connections */}
      <section className="rounded-lg bg-white p-6 shadow-card">
        <h2 className="mb-4 text-xl font-semibold text-neutral-800">
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
          <EmptyState message="No connections yet." action={{ label: "Find people", href: "/feed" }} />
        ) : (
          <>
            <ul className="divide-y divide-neutral-200" role="list">
              {connections.map((conn) => {
                const connAddress = conn.profile?.wallet_address || conn.requester_address;
                return (
                  <li key={conn.id} className="py-4">
                    <Link
                      href={`/profile/${connAddress}`}
                      className="flex items-center gap-3 rounded-md -mx-2 px-2 py-1 hover:bg-neutral-50 transition-colors"
                    >
                      {conn.profile?.profile_image_cid ? (
                        <img
                          src={`https://ipfs.io/ipfs/${conn.profile.profile_image_cid}`}
                          alt={getProfileAlt(conn)}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-neutral-400"
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
                        <p className="text-sm font-medium text-primary-700">
                          {getDisplayName(conn)}
                        </p>
                        {conn.profile?.headline && (
                          <p className="truncate text-xs text-neutral-400">
                            {conn.profile.headline}
                          </p>
                        )}
                        <p className="text-xs text-neutral-400">
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
              <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-neutral-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page >= totalPages}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
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
