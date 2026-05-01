"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useTransactionToast } from "@/contexts/TransactionContext";
import { parseTransactionError } from "@/lib/transaction-utils";
import TransactionStatus from "@/components/TransactionStatus";
import PageLayout from "@/components/PageLayout";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";

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
  holder: string;
  issuanceDate: string;
  ipfsCID: string;
}

const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io/ipfs";

export default function CredentialVerificationPage() {
  const params = useParams();
  const tokenId = params.tokenId as string;
  const { credentialNFT, isSessionLoading } = useWallet();
  const toast = useTransactionToast();

  const [credential, setCredential] = useState<CredentialDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredential = useCallback(async () => {
    if (!credentialNFT || !tokenId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data: CredentialData = await credentialNFT.getCredential(
        BigInt(tokenId)
      );

      setCredential({
        tokenId,
        credentialType: data.credentialType,
        issuer: data.issuer,
        holder: data.holder,
        issuanceDate: new Date(
          Number(data.issuanceTimestamp) * 1000
        ).toLocaleDateString(),
        ipfsCID: data.ipfsCID,
      });
    } catch (err: unknown) {
      const parsed = parseTransactionError(err);
      setError(parsed);

      // Show toast with retry for network errors
      const isNetworkError =
        err instanceof Error &&
        (("code" in err &&
          ((err as { code: string }).code === "NETWORK_ERROR" ||
            (err as { code: string }).code === "SERVER_ERROR")) ||
          err.message.toLowerCase().includes("network error") ||
          err.message.toLowerCase().includes("failed to fetch"));

      toast.showError(
        parsed,
        isNetworkError ? () => fetchCredential() : undefined
      );
    } finally {
      setLoading(false);
    }
  }, [credentialNFT, tokenId, toast]);

  // Trigger fetchCredential when credentialNFT becomes available
  useEffect(() => {
    if (credentialNFT) {
      fetchCredential();
    }
  }, [credentialNFT, fetchCredential]);

  // When credentialNFT is null and session is still loading, show loading state
  if (credentialNFT === null && isSessionLoading) {
    return (
      <PageLayout maxWidth="max-w-2xl">
        <div className="flex items-center justify-center py-20">
          <TransactionStatus message="Verifying credential on blockchain..." />
        </div>
      </PageLayout>
    );
  }

  // When credentialNFT is null and session is done loading, wallet is not connected
  if (credentialNFT === null && !isSessionLoading) {
    return (
      <PageLayout maxWidth="max-w-2xl">
        <EmptyState message="Wallet connection required to verify credentials." />
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout maxWidth="max-w-2xl">
        <div className="flex items-center justify-center py-20">
          <TransactionStatus message="Verifying credential on blockchain..." />
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout maxWidth="max-w-2xl">
        <ErrorState message={error} onRetry={fetchCredential} />
      </PageLayout>
    );
  }

  if (!credential) {
    return (
      <PageLayout maxWidth="max-w-2xl">
        <EmptyState message="Credential not found." />
      </PageLayout>
    );
  }

  return (
    <PageLayout maxWidth="max-w-2xl">
      <div className="space-y-6">
        {/* Header */}
        <section className="rounded-lg bg-white p-6 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">
                Credential Verification
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Token ID: {credential.tokenId}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-success-100 px-3 py-1 text-sm font-medium text-success-800">
              Verified
            </span>
          </div>
        </section>

        {/* Credential Details */}
        <section className="rounded-lg bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-neutral-900">
            Credential Details
          </h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-sm font-medium text-neutral-600">
                Credential Type
              </dt>
              <dd className="mt-1 text-sm text-neutral-900">
                {credential.credentialType}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-600">
                Issuer Address
              </dt>
              <dd className="mt-1 text-sm text-neutral-900 font-mono break-all">
                {credential.issuer}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-600">
                Holder Address
              </dt>
              <dd className="mt-1 text-sm text-neutral-900 font-mono break-all">
                {credential.holder}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-600">
                Issuance Date
              </dt>
              <dd className="mt-1 text-sm text-neutral-900">
                {credential.issuanceDate}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-600">
                Verification Status
              </dt>
              <dd className="mt-1">
                <span className="inline-flex items-center rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-medium text-success-800">
                  Verified
                </span>
                <p className="mt-1 text-xs text-neutral-600">
                  This credential is recorded on-chain and is tamper-proof.
                </p>
              </dd>
            </div>
          </dl>
        </section>

        {/* IPFS Document Link */}
        {credential.ipfsCID && (
          <section className="rounded-lg bg-white p-6 shadow-card">
            <h2 className="text-lg font-semibold text-neutral-900">
              Credential Document
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              The original credential document is stored on IPFS for
              decentralized, permanent access.
            </p>
            <a
              href={`${IPFS_GATEWAY}/${credential.ipfsCID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
            >
              View Document on IPFS
            </a>
            <p className="mt-2 text-xs text-neutral-400 font-mono break-all">
              CID: {credential.ipfsCID}
            </p>
          </section>
        )}
      </div>
    </PageLayout>
  );
}
