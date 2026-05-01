"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useTransaction } from "@/hooks/useTransaction";
import TransactionStatus from "@/components/TransactionStatus";

interface EndorseButtonProps {
  /** The wallet address of the user to endorse */
  endorsedAddress: string;
  /** Called after a successful endorsement so the parent can refresh data */
  onEndorsed?: () => void;
}

/**
 * Endorsement component that allows the current user to endorse another user
 * for a specific skill via the ReputationToken smart contract.
 *
 * Uses the signer-connected contract instance from WalletContext.
 */
export default function EndorseButton({
  endorsedAddress,
  onEndorsed,
}: EndorseButtonProps) {
  const { address, reputationToken } = useWallet();
  const [skillId, setSkillId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const tx = useTransaction<void>({
    pendingMessage: "Submitting endorsement on blockchain...",
    successMessage: "Endorsement recorded successfully!",
  });

  const handleEndorse = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError(null);

      if (!reputationToken) {
        setValidationError(
          "Smart contract is not available. Please check your network connection."
        );
        return;
      }

      if (!address) {
        setValidationError("Please connect your wallet first.");
        return;
      }

      if (address.toLowerCase() === endorsedAddress.toLowerCase()) {
        setValidationError("You cannot endorse yourself.");
        return;
      }

      const trimmedSkill = skillId.trim();
      if (!trimmedSkill) {
        setValidationError("Please enter a skill to endorse.");
        return;
      }

      const result = await tx.execute(async () => {
        const endorseTx = await reputationToken.endorse(
          endorsedAddress,
          trimmedSkill
        );
        await endorseTx.wait();
      });

      // Use return value instead of tx.step to avoid stale closure
      if (result !== null) {
        // Success: reset form and notify parent
        setSkillId("");
        setShowForm(false);
        onEndorsed?.();
      }
      // Failure (result === null): retain form state for retry
    },
    [reputationToken, address, endorsedAddress, skillId, tx, onEndorsed]
  );

  // Don't show the endorse button if viewing your own profile or not connected
  if (!address || address.toLowerCase() === endorsedAddress.toLowerCase()) {
    return null;
  }

  if (!reputationToken) {
    return null;
  }

  const displayError = validationError || tx.error;

  return (
    <div className="mt-4">
      {!showForm && tx.step !== "success" && (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Endorse
        </button>
      )}

      {tx.step === "success" && (
        <div
          role="status"
          className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700"
        >
          Endorsement recorded on-chain!
          <button
            onClick={() => {
              tx.reset();
              setShowForm(false);
            }}
            className="ml-2 text-green-800 underline hover:text-green-900"
          >
            Endorse another skill
          </button>
        </div>
      )}

      {showForm && tx.step !== "success" && (
        <form onSubmit={handleEndorse} className="space-y-3">
          {displayError && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {displayError}
            </div>
          )}

          {tx.isLoading && (
            <TransactionStatus message="Submitting endorsement..." />
          )}

          <div>
            <label
              htmlFor="skill-id"
              className="block text-sm font-medium text-gray-700"
            >
              Skill
            </label>
            <input
              id="skill-id"
              type="text"
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              placeholder="e.g., Solidity, React, Smart Contracts"
              disabled={tx.isLoading}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={tx.isLoading || !skillId.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tx.isLoading ? "Processing..." : "Submit Endorsement"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setValidationError(null);
                tx.reset();
              }}
              disabled={tx.isLoading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
