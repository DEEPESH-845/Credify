"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { uploadFile, ApiRequestError } from "@/lib/api";

type IssueStep =
  | "idle"
  | "uploading"
  | "minting"
  | "confirming"
  | "success"
  | "error";

interface MintResult {
  tokenId: string;
  holderAddress: string;
  credentialType: string;
  ipfsCID: string;
}

/**
 * Parse a human-readable revert reason from a contract transaction error.
 */
function parseRevertReason(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message;

    // ethers.js v6 wraps revert reasons in the error message
    const revertMatch = message.match(/reason="([^"]+)"/);
    if (revertMatch) return revertMatch[1];

    // Some providers include the revert string directly
    const revertStringMatch = message.match(/reverted with reason string '([^']+)'/);
    if (revertStringMatch) return revertStringMatch[1];

    // Check for user rejection
    if (
      ("code" in err && (err as { code: number }).code === 4001) ||
      ("code" in err && (err as { code: string }).code === "ACTION_REJECTED")
    ) {
      return "Transaction was rejected in your wallet.";
    }

    return message;
  }
  return "An unexpected error occurred during the transaction.";
}

export default function IssuerDashboardPage() {
  const { address, jwt, credentialNFT } = useWallet();

  const [holderAddress, setHolderAddress] = useState("");
  const [credentialType, setCredentialType] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [step, setStep] = useState<IssueStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MintResult | null>(null);

  const resetForm = useCallback(() => {
    setHolderAddress("");
    setCredentialType("");
    setDocumentFile(null);
    setStep("idle");
    setError(null);
    setResult(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setResult(null);

      // Validate inputs
      if (!address || !jwt) {
        setError("Please connect your wallet and authenticate first.");
        return;
      }

      if (!credentialNFT) {
        setError("Smart contract is not available. Please check your network connection.");
        return;
      }

      if (!holderAddress.trim()) {
        setError("Holder wallet address is required.");
        return;
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(holderAddress.trim())) {
        setError("Invalid holder wallet address. Must be a valid Ethereum address.");
        return;
      }

      if (!credentialType.trim()) {
        setError("Credential type is required.");
        return;
      }

      if (!documentFile) {
        setError("Please select a credential document (PDF) to upload.");
        return;
      }

      try {
        // Step 1: Upload document to IPFS
        setStep("uploading");
        const { cid } = await uploadFile(documentFile, jwt);

        // Step 2: Call mintCredential on the contract
        setStep("minting");
        const tx = await credentialNFT.mintCredential(
          holderAddress.trim(),
          credentialType.trim(),
          cid
        );

        // Step 3: Wait for transaction confirmation
        setStep("confirming");
        const receipt = await tx.wait();

        // Step 4: Parse the CredentialIssued event to get the token ID
        let tokenId = "unknown";
        if (receipt && receipt.logs) {
          for (const log of receipt.logs) {
            try {
              const parsed = credentialNFT.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              });
              if (parsed && parsed.name === "CredentialIssued") {
                tokenId = parsed.args.tokenId.toString();
                break;
              }
            } catch {
              // Not a matching log, skip
            }
          }
        }

        setResult({
          tokenId,
          holderAddress: holderAddress.trim(),
          credentialType: credentialType.trim(),
          ipfsCID: cid,
        });
        setStep("success");
      } catch (err: unknown) {
        setStep("error");

        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError(parseRevertReason(err));
        }
      }
    },
    [address, jwt, credentialNFT, holderAddress, credentialType, documentFile]
  );

  const isLoading =
    step === "uploading" || step === "minting" || step === "confirming";

  const statusMessage = (() => {
    switch (step) {
      case "uploading":
        return "Uploading document to IPFS...";
      case "minting":
        return "Submitting transaction to blockchain...";
      case "confirming":
        return "Waiting for transaction confirmation...";
      default:
        return null;
    }
  })();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <section className="rounded-lg bg-white p-6 shadow-md">
          <h1 className="text-2xl font-bold text-gray-900">
            Issuer Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Issue verifiable credentials as NFTs on the blockchain.
          </p>
        </section>

        {/* Success confirmation */}
        {step === "success" && result && (
          <section
            role="status"
            aria-label="Success"
            className="rounded-lg border border-green-200 bg-green-50 p-6 shadow-md"
          >
            <h2 className="text-lg font-semibold text-green-800">
              Credential Issued Successfully
            </h2>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-sm font-medium text-green-700">
                  Token ID
                </dt>
                <dd className="mt-1 text-sm text-green-900">
                  {result.tokenId}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-green-700">
                  Holder Address
                </dt>
                <dd className="mt-1 text-sm text-green-900 font-mono break-all">
                  {result.holderAddress}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-green-700">
                  Credential Type
                </dt>
                <dd className="mt-1 text-sm text-green-900">
                  {result.credentialType}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-green-700">
                  IPFS CID
                </dt>
                <dd className="mt-1 text-sm text-green-900 font-mono break-all">
                  {result.ipfsCID}
                </dd>
              </div>
            </dl>
            <button
              onClick={resetForm}
              className="mt-6 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              Issue Another Credential
            </button>
          </section>
        )}

        {/* Form */}
        {step !== "success" && (
          <section className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="text-lg font-semibold text-gray-900">
              Issue New Credential
            </h2>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {isLoading && (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"
                  role="status"
                  aria-label="Loading"
                />
                {statusMessage && (
                  <p className="text-sm text-gray-600">{statusMessage}</p>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="holderAddress"
                  className="block text-sm font-medium text-gray-700"
                >
                  Holder Wallet Address
                </label>
                <input
                  id="holderAddress"
                  type="text"
                  value={holderAddress}
                  onChange={(e) => setHolderAddress(e.target.value)}
                  placeholder="0x..."
                  disabled={isLoading}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label
                  htmlFor="credentialType"
                  className="block text-sm font-medium text-gray-700"
                >
                  Credential Type
                </label>
                <input
                  id="credentialType"
                  type="text"
                  value={credentialType}
                  onChange={(e) => setCredentialType(e.target.value)}
                  placeholder="e.g., Bachelor of Science in Computer Science"
                  disabled={isLoading}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label
                  htmlFor="documentFile"
                  className="block text-sm font-medium text-gray-700"
                >
                  Credential Document (PDF)
                </label>
                <input
                  id="documentFile"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) =>
                    setDocumentFile(e.target.files?.[0] ?? null)
                  }
                  disabled={isLoading}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Processing..." : "Issue Credential"}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
