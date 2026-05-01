"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@/contexts/WalletContext";
import { useTransactionToast } from "@/contexts/TransactionContext";
import { parseTransactionError } from "@/lib/transaction-utils";
import { getProfile, ProfileData, ApiRequestError } from "@/lib/api";
import { truncateAddress } from "@/lib/utils";
import PageLayout from "@/components/PageLayout";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
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
  const { address, jwt, credentialNFT, reputationToken, isSessionLoading } = useWallet();
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

      const credentialList: CredentialDisplay[] = await Promise.all(
        tokenIds.map(async (tokenId) => {
          const data: CredentialData = await credentialNFT.getCredential(tokenId);
          return {
            tokenId: tokenId.toString(),
            credentialType: data.credentialType,
            issuer: data.issuer,
            issuanceDate: new Date(Number(data.issuanceTimestamp) * 1000).toLocaleDateString(),
            ipfsCID: data.ipfsCID,
          };
        })
      );

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
    if (isSessionLoading) return;

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
  }, [isSessionLoading, fetchProfile, fetchCredentials, fetchReputation]);

  // Memoize profile image URL, recomputed only when profile_image_cid changes
  const profileImageUrl = useMemo(() => {
    if (!profile?.profile_image_cid) return null;
    return `${IPFS_GATEWAY}/${profile.profile_image_cid}`;
  }, [profile?.profile_image_cid]);

  // Determine if this is the user's own profile (case-insensitive)
  const isOwnProfile = useMemo(() => {
    if (!address || !profileAddress) return false;
    return address.toLowerCase() === profileAddress.toLowerCase();
  }, [address, profileAddress]);

  // Derive alt text for profile image
  const profileImageAlt = useMemo(() => {
    if (profile?.display_name) {
      return `${profile.display_name} profile photo`;
    }
    return `${truncateAddress(profileAddress)} profile photo`;
  }, [profile?.display_name, profileAddress]);

  if (loading) {
    return (
      <PageLayout>
        <div role="status" aria-label="Loading profile">
          <span className="sr-only">Loading profile...</span>
          {/* Skeleton layout: avatar circle, name line, headline line, bio block */}
          <section className="rounded-xl bg-neutral-900/80 border border-white/[0.06] p-6 backdrop-blur-sm shadow-card">
            <div className="flex items-start gap-6">
              <Skeleton className="h-24 w-24 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-3">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-80" />
              </div>
            </div>
            <div className="mt-4 border-t border-white/[0.06] pt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </section>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <ErrorState message={error} onRetry={fetchProfile} />
      </PageLayout>
    );
  }

  if (!profile) {
    return (
      <PageLayout>
        <div className="w-full max-w-md mx-auto rounded-xl bg-neutral-900/80 border border-white/[0.06] p-8 backdrop-blur-sm shadow-card text-center">
          <p className="text-neutral-400">Profile not found</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-6">
        {/* Navigation links */}
        <div className="flex items-center justify-between">
          <Link
            href="/feed"
            className="text-sm text-primary-400 hover:text-primary-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 rounded"
          >
            ← Back to Feed
          </Link>
          {isOwnProfile && (
            <Link
              href="/profile/edit"
              className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              Edit Profile
            </Link>
          )}
        </div>

        {/* Profile Card */}
        <section className="rounded-xl bg-neutral-900/80 border border-white/[0.06] p-6 backdrop-blur-sm shadow-card">
          <div className="flex items-start gap-6">
            {/* Profile Image */}
            <div className="flex-shrink-0">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={profileImageAlt}
                  className="h-24 w-24 rounded-full object-cover border-2 border-white/[0.06]"
                />
              ) : (
                <div
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-900/50 text-2xl font-bold text-primary-400 border-2 border-white/[0.06]"
                  aria-label="Default avatar"
                >
                  {(profile.display_name || profile.wallet_address)?.[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-neutral-50 truncate">
                {profile.display_name || "Unnamed User"}
              </h1>
              {profile.headline && (
                <p className="mt-1 text-neutral-400 truncate">{profile.headline}</p>
              )}
              {profile.location && (
                <p className="mt-1 text-sm text-neutral-500">{profile.location}</p>
              )}
              <p className="mt-2 text-xs text-neutral-500 font-mono truncate">
                {profile.wallet_address}
              </p>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <h2 className="text-sm font-semibold text-neutral-300">About</h2>
              <p className="mt-1 text-sm text-neutral-400 whitespace-pre-wrap">{profile.bio}</p>
            </div>
          )}
        </section>

        {/* Reputation Section */}
        <section className="rounded-xl bg-neutral-900/80 border border-white/[0.06] p-6 backdrop-blur-sm shadow-card">
          <h2 className="text-lg font-semibold text-neutral-50">Reputation</h2>
          {blockchainLoading ? (
            <div className="mt-3">
              <TransactionStatus message="Loading reputation from blockchain..." />
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-3xl font-bold text-primary-400">{reputationBalance}</span>
              <span className="text-sm text-neutral-500">Reputation Tokens</span>
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
        <section className="rounded-xl bg-neutral-900/80 border border-white/[0.06] p-6 backdrop-blur-sm shadow-card">
          <h2 className="text-lg font-semibold text-neutral-50">Credentials</h2>
          {blockchainLoading ? (
            <div className="mt-3">
              <TransactionStatus message="Loading credentials from blockchain..." />
            </div>
          ) : credentials.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No credentials found</p>
          ) : (
            <ul className="mt-3 space-y-3" role="list">
              {credentials.map((cred) => (
                <li
                  key={cred.tokenId}
                  className="rounded-md border border-white/[0.06] p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-neutral-50">{cred.credentialType}</h3>
                      <p className="mt-1 text-xs text-neutral-500 font-mono truncate">
                        Issuer: {cred.issuer}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Issued: {cred.issuanceDate}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-success-500/10 px-2.5 py-0.5 text-xs font-medium text-success-400">
                      Verified
                    </span>
                  </div>
                  {cred.ipfsCID && (
                    <a
                      href={`${IPFS_GATEWAY}/${cred.ipfsCID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-primary-400 hover:text-primary-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 rounded"
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
    </PageLayout>
  );
}
