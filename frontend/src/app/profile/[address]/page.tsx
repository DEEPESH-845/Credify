"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useTransactionToast } from "@/contexts/TransactionContext";
import { parseTransactionError } from "@/lib/transaction-utils";
import { getProfile, ProfileData, ApiRequestError } from "@/lib/api";
import TransactionStatus from "@/components/TransactionStatus";
import EndorseButton from "@/components/EndorseButton";

interface CredentialData {
  credentialType: string;
  issuer: string;
  holder: string;
  issuanceTimestamp: bigint;
  ipfsCID: string;
}

interface CredentialDisplay {
  tokenId: string;
  credentialType: string;
  issuer: string;
  issuanceDate: string;
  ipfsCID: string;
}

const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io/ipfs";

export default function ProfilePage() {
  const params = useParams();
  const profileAddress = params.address as string;
  const { jwt, credentialNFT, reputationToken } = useWallet();
  const toast = useTransactionToast();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [credentials, setCredentials] = useState<CredentialDisplay[]>([]);
  const [reputationBalance, setReputationBalance] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [blockchainLoading, setBlockchainLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!jwt || !profileAddress) return;

    try {
      const data = await getProfile(profileAddress, jwt);
      setProfile(data);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load profile");
      }
    }
  }, [jwt, profileAddress]);

  const fetchCredentials = useCallback(async () => {
    if (!credentialNFT || !profileAddress) return;

    try {
      const tokenIds: bigint[] = await credentialNFT.getHolderCredentials(profileAddress);
      const credentialList: CredentialDisplay[] = [];

      for (const tokenId of tokenIds) {
        const data: CredentialData = await credentialNFT.getCredential(tokenId);
        credentialList.push({
          tokenId: tokenId.toString(),
          credentialType: data.credentialType,
          issuer: data.issuer,
          issuanceDate: new Date(Number(data.issuanceTimestamp) * 1000).toLocaleDateString(),
          ipfsCID: data.ipfsCID,
        });
      }

      setCredentials(credentialList);
    } catch (err: unknown) {
      const parsed = parseTransactionError(err);

      // Show toast for blockchain read errors with retry
      const isNetworkError =
        err instanceof Error &&
        (("code" in err &&
          ((err as { code: string }).code === "NETWORK_ERROR" ||
            (err as { code: string }).code === "SERVER_ERROR")) ||
          err.message.toLowerCase().includes("network error") ||
          err.message.toLowerCase().includes("failed to fetch"));

      toast.showError(
        `Failed to load credentials: ${parsed}`,
        isNetworkError ? () => fetchCredentials() : undefined
      );
    }
  }, [credentialNFT, profileAddress, toast]);

  const fetchReputation = useCallback(async () => {
    if (!reputationToken || !profileAddress) return;

    try {
      const balance: bigint = await reputationToken.balanceOf(profileAddress);
      setReputationBalance(balance.toString());
    } catch (err: unknown) {
      const parsed = parseTransactionError(err);

      const isNetworkError =
        err instanceof Error &&
        (("code" in err &&
          ((err as { code: string }).code === "NETWORK_ERROR" ||
            (err as { code: string }).code === "SERVER_ERROR")) ||
          err.message.toLowerCase().includes("network error") ||
          err.message.toLowerCase().includes("failed to fetch"));

      toast.showError(
        `Failed to load reputation: ${parsed}`,
        isNetworkError ? () => fetchReputation() : undefined
      );
    }
  }, [reputationToken, profileAddress, toast]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setError(null);

      await fetchProfile();

      if (!cancelled) {
        setLoading(false);
      }

      // Fetch blockchain data in parallel (non-blocking)
      setBlockchainLoading(true);
      await Promise.all([fetchCredentials(), fetchReputation()]);
      if (!cancelled) {
        setBlockchainLoading(false);
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [fetchProfile, fetchCredentials, fetchReputation]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <TransactionStatus message="Loading profile..." />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md text-center">
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md text-center">
          <p className="text-gray-600">Profile not found</p>
        </div>
      </main>
    );
  }

  const profileImageUrl = profile.profile_image_cid
    ? `${IPFS_GATEWAY}/${profile.profile_image_cid}`
    : null;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Profile Card */}
        <section className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-start gap-6">
            {/* Profile Image */}
            <div className="flex-shrink-0">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={`${profile.display_name || "User"} profile`}
                  className="h-24 w-24 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600 border-2 border-gray-200"
                  aria-label="Default avatar"
                >
                  {(profile.display_name || profile.wallet_address)?.[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 truncate">
                {profile.display_name || "Unnamed User"}
              </h1>
              {profile.headline && (
                <p className="mt-1 text-gray-600 truncate">{profile.headline}</p>
              )}
              {profile.location && (
                <p className="mt-1 text-sm text-gray-500">{profile.location}</p>
              )}
              <p className="mt-2 text-xs text-gray-400 font-mono truncate">
                {profile.wallet_address}
              </p>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <h2 className="text-sm font-semibold text-gray-700">About</h2>
              <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{profile.bio}</p>
            </div>
          )}
        </section>

        {/* Reputation Section */}
        <section className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="text-lg font-semibold text-gray-900">Reputation</h2>
          {blockchainLoading ? (
            <div className="mt-3">
              <TransactionStatus message="Loading reputation from blockchain..." />
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-3xl font-bold text-blue-600">{reputationBalance}</span>
              <span className="text-sm text-gray-500">Reputation Tokens</span>
            </div>
          )}
          <EndorseButton
            endorsedAddress={profileAddress}
            onEndorsed={() => {
              fetchReputation();
            }}
          />
        </section>

        {/* Credentials Section */}
        <section className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="text-lg font-semibold text-gray-900">Credentials</h2>
          {blockchainLoading ? (
            <div className="mt-3">
              <TransactionStatus message="Loading credentials from blockchain..." />
            </div>
          ) : credentials.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No credentials found</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {credentials.map((cred) => (
                <li
                  key={cred.tokenId}
                  className="rounded-md border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{cred.credentialType}</h3>
                      <p className="mt-1 text-xs text-gray-500 font-mono truncate">
                        Issuer: {cred.issuer}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Issued: {cred.issuanceDate}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      Verified
                    </span>
                  </div>
                  {cred.ipfsCID && (
                    <a
                      href={`${IPFS_GATEWAY}/${cred.ipfsCID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-blue-600 hover:underline"
                    >
                      View Document
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
