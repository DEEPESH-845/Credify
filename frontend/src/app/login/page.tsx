"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { requestNonce, verifySignature, ApiRequestError } from "@/lib/api";
import { truncateAddress } from "@/lib/utils";

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

  const handleSignIn = async () => {
    if (!address || !signer) return;
    setError(null);
    await authenticate(address, signer);
  };

  // Wallet is already connected but user has no JWT yet
  const isWalletConnected =
    address !== null && signer !== null && jwt === null && authStep === "idle";

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 bg-gradient-mesh p-6">
      <div className="w-full max-w-md rounded-2xl bg-neutral-900/60 backdrop-blur-xl border border-white/[0.06] p-8 shadow-2xl">
        {/* Gradient accent bar */}
        <div className="mx-auto mb-6 h-1 w-16 rounded-full bg-gradient-to-r from-primary-500 to-primary-400" />

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-neutral-50">
            Blockchain Social Network
          </h1>
          <p className="mt-2 text-neutral-400">
            Connect your wallet to get started
          </p>
        </div>

        {displayError && (
          <div
            role="alert"
            className="mb-6 rounded-md border border-error-500/20 bg-error-500/10 p-4 text-sm text-error-300"
          >
            {displayError}
          </div>
        )}

        {isLoading && (
          <div className="mb-6 flex flex-col items-center gap-3">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-700 border-t-primary-500"
              role="status"
              aria-label="Loading"
            />
            {statusMessage && (
              <p className="text-sm text-neutral-400">{statusMessage}</p>
            )}
          </div>
        )}

        {isWalletConnected && !isLoading ? (
          <>
            <p className="mb-4 text-center text-sm text-neutral-400">
              Wallet connected: <span className="font-medium text-neutral-50">{truncateAddress(address)}</span>
            </p>
            <button
              onClick={handleSignIn}
              className="w-full rounded-lg bg-primary-600 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              Sign In
            </button>
          </>
        ) : (
          <button
            onClick={handleConnect}
            disabled={isLoading}
            className="w-full rounded-lg bg-primary-600 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Connecting..." : "Connect Wallet"}
          </button>
        )}

        <p className="mt-6 text-center text-xs text-neutral-500">
          You will be asked to sign a message to verify wallet ownership. No
          transaction fees are required.
        </p>
      </div>
    </main>
  );
}
