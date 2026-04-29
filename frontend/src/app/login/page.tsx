"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { requestNonce, verifySignature, ApiRequestError } from "@/lib/api";

type AuthStep = "idle" | "connecting" | "signing" | "verifying" | "done";

export default function LoginPage() {
  const router = useRouter();
  const {
    address,
    signer,
    jwt,
    setJwt,
    isConnecting,
    error: walletError,
    connectWallet,
  } = useWallet();

  const [authStep, setAuthStep] = useState<AuthStep>("idle");
  const [error, setError] = useState<string | null>(null);

  // Redirect to /feed if already authenticated
  useEffect(() => {
    if (jwt) {
      router.replace("/feed");
    }
  }, [jwt, router]);

  // Once wallet is connected (address + signer available), start the auth flow
  const authenticate = useCallback(
    async (walletAddress: string, walletSigner: typeof signer) => {
      if (!walletSigner) return;

      setError(null);

      try {
        // Step 1: Request nonce from backend
        setAuthStep("signing");
        const { nonce } = await requestNonce(walletAddress);

        // Step 2: Sign the nonce with the wallet
        const signature = await walletSigner.signMessage(nonce);

        // Step 3: Verify signature with backend and get JWT
        setAuthStep("verifying");
        const { token } = await verifySignature(
          walletAddress,
          signature,
          nonce
        );

        // Step 4: Store JWT and redirect
        setJwt(token);
        setAuthStep("done");
        router.replace("/feed");
      } catch (err: unknown) {
        setAuthStep("idle");

        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else if (err instanceof Error) {
          // MetaMask signature rejection or other errors
          if ("code" in err && (err as { code: number }).code === 4001) {
            setError(
              "Signature request was rejected. Please approve the signature in MetaMask to log in."
            );
          } else if (
            "code" in err &&
            (err as { code: string }).code === "ACTION_REJECTED"
          ) {
            setError(
              "Signature request was rejected. Please approve the signature in MetaMask to log in."
            );
          } else {
            setError(err.message);
          }
        } else {
          setError("An unexpected error occurred during authentication.");
        }
      }
    },
    [setJwt, router]
  );

  // Trigger authentication automatically when wallet connects
  useEffect(() => {
    if (address && signer && !jwt && authStep === "connecting") {
      authenticate(address, signer);
    }
  }, [address, signer, jwt, authStep, authenticate]);

  const handleConnect = async () => {
    setError(null);
    setAuthStep("connecting");
    await connectWallet();
    // The useEffect above will pick up the address/signer change
    // and continue the auth flow
  };

  // If wallet was already connected but no JWT, start auth directly
  useEffect(() => {
    if (address && signer && !jwt && authStep === "idle") {
      // Wallet is already connected from a previous session — don't auto-auth,
      // let the user click the button
    }
  }, [address, signer, jwt, authStep]);

  const isLoading =
    isConnecting ||
    authStep === "connecting" ||
    authStep === "signing" ||
    authStep === "verifying";

  const displayError = walletError || error;

  const statusMessage = (() => {
    switch (authStep) {
      case "connecting":
        return "Connecting to MetaMask...";
      case "signing":
        return "Please sign the message in MetaMask...";
      case "verifying":
        return "Verifying signature...";
      default:
        return null;
    }
  })();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Blockchain Social Network
          </h1>
          <p className="mt-2 text-gray-600">
            Connect your wallet to get started
          </p>
        </div>

        {displayError && (
          <div
            role="alert"
            className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {displayError}
          </div>
        )}

        {isLoading && (
          <div className="mb-6 flex flex-col items-center gap-3">
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

        <button
          onClick={handleConnect}
          disabled={isLoading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Connecting..." : "Connect Wallet"}
        </button>

        <p className="mt-6 text-center text-xs text-gray-500">
          You will be asked to sign a message to verify wallet ownership. No
          transaction fees are required.
        </p>
      </div>
    </main>
  );
}
