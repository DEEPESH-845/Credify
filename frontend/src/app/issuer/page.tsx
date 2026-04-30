"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { uploadFile, ApiRequestError } from "@/lib/api";
import { useTransaction } from "@/hooks/useTransaction";
import TransactionStatus from "@/components/TransactionStatus";

interface MintResult {
  tokenId: string;
  holderAddress: string;
  credentialType: string;
  ipfsCID: string;
}

export default function IssuerDashboardPage() {
  const { address, jwt, credentialNFT } = useWallet();

  const [holderAddress, setHolderAddress] = useState("");
  const [credentialType, setCredentialType] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const tx = useTransaction<MintResult>({
    pendingMessage: "Issuing credential on blockchain...",
    successMessage: "Credential issued successfully!",
  });

  const resetForm = useCallback(() => {
    setHolderAddress("");
    setCredentialType("");
    setDocumentFile(null);
    setStatusMessage(null);
    setValidationError(null);
    tx.reset();
  }, [tx]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError(null);

      // Validate inputs
      if (!address || !jwt) {
        setValidationError("Please connect your wallet and authenticate first.");
        return;
      }

      if (!credentialNFT) {
        setValidationError("Smart contract is not available. Please check your network connection.");
        return;
      }

      if (!holderAddress.trim()) {
        setValidationError("Holder wallet address is required.");
        return;
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(holderAddress.trim())) {
        setValidationError("Invalid holder wallet address. Must be a valid Ethereum address.");
        return;
      }

      if (!credentialType.trim()) {
        setValidationError("Credential type is required.");
        return;
      }

      if (!documentFile) {
        setValidationError("Please select a credential document (PDF) to upload.");
        return;
      }

      await tx.execute(async () => {
        // Step 1: Upload document to IPFS
        setStatusMessage("Uploading document to IPFS...");
        let cid: string;
        try {
          const uploadResult = await uploadFile(documentFile, jwt);
          cid = uploadResult.cid;
        } catch (err: unknown) {
          if (err instanceof ApiRequestError) {
            throw new Error(err.message);
          }
          throw err;
        }

        // Step 2: Call mintCredential on the contract
        setStatusMessage("Submitting transaction to blockchain...");
        const mintTx = await credentialNFT.mintCredential(
          holderAddress.trim(),
          credentialType.trim(),
          cid
        );

        // Step 3: Wait for transaction confirmation
        setStatusMessage("Waiting for transaction confirmation...");
        const receipt = await mintTx.wait();

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

        setStatusMessage(null);
        return {
          tokenId,
          holderAddress: holderAddress.trim(),
          credentialType: credentialType.trim(),
          ipfsCID: cid,
        };
      });
    },
    [address, jwt, credentialNFT, holderAddress, credentialType, documentFile, tx]
  );

  const isLoading = tx.isLoading;
  const displayError = validationError || tx.error;

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
        {tx.step === "success" && tx.result && (
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
                  {tx.result.tokenId}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-green-700">
                  Holder Address
                </dt>
                <dd className="mt-1 text-sm text-green-900 font-mono break-all">
                  {tx.result.holderAddress}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-green-700">
                  Credential Type
                </dt>
                <dd className="mt-1 text-sm text-green-900">
                  {tx.result.credentialType}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-green-700">
                  IPFS CID
                </dt>
                <dd className="mt-1 text-sm text-green-900 font-mono break-all">
                  {tx.result.ipfsCID}
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
        {tx.step !== "success" && (
          <section className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="text-lg font-semibold text-gray-900">
              Issue New Credential
            </h2>

            {displayError && (
              <div
                role="alert"
                className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {displayError}
              </div>
            )}

            {isLoading && statusMessage && (
              <div className="mt-4">
                <TransactionStatus message={statusMessage} />
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
