"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useTransactionToast } from "@/contexts/TransactionContext";
import { parseTransactionError } from "@/lib/transaction-utils";
import TransactionStatus from "@/components/TransactionStatus";

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
  const { credentialNFT } = useWallet();
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

  useEffect(() => {
    fetchCredential();
  }, [fetchCredential]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <TransactionStatus message="Verifying credential on blockchain..." />
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
          <button
            onClick={fetchCredential}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!credential) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md text-center">
          <p className="text-gray-600">Credential not found</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <section className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Credential Verification
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Token ID: {credential.tokenId}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              Verified
            </span>
          </div>
        </section>

        {/* Credential Details */}
        <section className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="text-lg font-semibold text-gray-900">
            Credential Details
          </h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Credential Type
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {credential.credentialType}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Issuer Address
              </dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono break-all">
                {credential.issuer}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Holder Address
              </dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono break-all">
                {credential.holder}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Issuance Date
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {credential.issuanceDate}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Verification Status
              </dt>
              <dd className="mt-1">
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  Verified
                </span>
                <p className="mt-1 text-xs text-gray-500">
                  This credential is recorded on-chain and is tamper-proof.
                </p>
              </dd>
            </div>
          </dl>
        </section>

        {/* IPFS Document Link */}
        {credential.ipfsCID && (
          <section className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="text-lg font-semibold text-gray-900">
              Credential Document
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              The original credential document is stored on IPFS for
              decentralized, permanent access.
            </p>
            <a
              href={`${IPFS_GATEWAY}/${credential.ipfsCID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              View Document on IPFS
            </a>
            <p className="mt-2 text-xs text-gray-400 font-mono break-all">
              CID: {credential.ipfsCID}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
