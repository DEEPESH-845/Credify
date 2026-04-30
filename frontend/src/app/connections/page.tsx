"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function ConnectionsPage() {
  const router = useRouter();
  const { address, jwt, isSessionLoading } = useWallet();

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

  // Redirect if not authenticated
  useEffect(() => {
    if (!isSessionLoading && !jwt) {
      router.replace("/login");
    }
  }, [jwt, isSessionLoading, router]);

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

  if (!jwt) return null;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">Connections</h1>

        {/* Send Connection Request */}
        <section className="mb-8 rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">
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
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={sendLoading}
            />
            <button
              type="submit"
              disabled={sendLoading || !recipientAddress.trim()}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendLoading ? "Sending..." : "Send Request"}
            </button>
          </form>
          {sendSuccess && (
            <p className="mt-3 text-sm text-green-600" role="status">
              {sendSuccess}
            </p>
          )}
          {sendError && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {sendError}
            </p>
          )}
        </section>

        {/* Pending Requests */}
        {!pendingLoading && pendingRequests.length > 0 && (
          <section className="mb-8 rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-semibold text-gray-800">
              Pending Requests
            </h2>
            <ul className="divide-y divide-gray-200" role="list">
              {pendingRequests.map((conn) => (
                <li
                  key={conn.id}
                  className="flex items-center justify-between py-4"
                >
                  <div className="flex items-center gap-3">
                    {conn.profile?.profile_image_cid ? (
                      <img
                        src={`https://ipfs.io/ipfs/${conn.profile.profile_image_cid}`}
                        alt={`${conn.profile.display_name || "User"} avatar`}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-500"
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
                      <p className="text-sm font-medium text-gray-900">
                        {conn.profile?.display_name || "Unknown User"}
                      </p>
                      {conn.profile?.headline && (
                        <p className="text-xs text-gray-500">
                          {conn.profile.headline}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        {conn.requester_address}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(conn.id)}
                      disabled={actionLoading === conn.id}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDecline(conn.id)}
                      disabled={actionLoading === conn.id}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
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
            className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Accepted Connections */}
        <section className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">
            My Connections
          </h2>

          {loading ? (
            <div className="flex flex-col items-center py-8">
              <div
                className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"
                role="status"
                aria-label="Loading"
              />
              <p className="mt-3 text-sm text-gray-500">
                Loading connections...
              </p>
            </div>
          ) : connections.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No connections yet
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-200" role="list">
                {connections.map((conn) => (
                  <li key={conn.id} className="flex items-center gap-3 py-4">
                    {conn.profile?.profile_image_cid ? (
                      <img
                        src={`https://ipfs.io/ipfs/${conn.profile.profile_image_cid}`}
                        alt={`${conn.profile.display_name || "User"} avatar`}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-500"
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
                      <p className="text-sm font-medium text-gray-900">
                        {conn.profile?.display_name || "Unknown User"}
                      </p>
                      {conn.profile?.headline && (
                        <p className="truncate text-xs text-gray-500">
                          {conn.profile.headline}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        {conn.profile?.wallet_address ||
                          conn.requester_address}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={page >= totalPages}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
