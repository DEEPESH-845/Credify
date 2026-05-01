"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { BrowserProvider, Contract, JsonRpcSigner } from "ethers";
import { getContractAddresses } from "@/lib/contracts-config";
import CredentialNFTArtifact from "@/contracts/CredentialNFT.json";
import ReputationTokenArtifact from "@/contracts/ReputationToken.json";

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export interface WalletContextValue {
  address: string | null;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  credentialNFT: Contract | null;
  reputationToken: Contract | null;
  chainId: number | null;
  jwt: string | null;
  setJwt: (token: string | null) => void;
  isConnecting: boolean;
  /** True while the provider is restoring session from localStorage */
  isSessionLoading: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  provider: null,
  signer: null,
  credentialNFT: null,
  reputationToken: null,
  chainId: null,
  jwt: null,
  setJwt: () => {},
  isConnecting: false,
  isSessionLoading: true,
  error: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
});

export function useWallet(): WalletContextValue {
  return useContext(WalletContext);
}

const JWT_STORAGE_KEY = "bsn_jwt";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [jwt, setJwtState] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load JWT from localStorage on mount (client-side only).
  // This runs once after hydration and sets both jwt and isSessionLoading.
  useEffect(() => {
    const stored = localStorage.getItem(JWT_STORAGE_KEY);
    if (stored) {
      setJwtState(stored);
    } else {
      // No stored session — done loading
      setIsSessionLoading(false);
    }
  }, []);

  // Auto-reconnect wallet when a stored JWT exists but address is not set.
  // Uses eth_accounts (no user prompt) to silently restore the connection.
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) {
      // No MetaMask available — if jwt was loaded, session is still "loaded"
      // (user can make API calls, just no contract interactions)
      if (jwt) setIsSessionLoading(false);
      return;
    }
    if (address) {
      // Already connected — session fully restored
      setIsSessionLoading(false);
      return;
    }
    if (!jwt) return; // No session to restore (handled by the JWT loading effect)

    let cancelled = false;

    (async () => {
      try {
        // eth_accounts returns already-connected accounts without prompting
        const accounts = (await window.ethereum!.request({
          method: "eth_accounts",
        })) as string[];

        if (cancelled) return;

        if (!accounts || accounts.length === 0) {
          setIsSessionLoading(false);
          return;
        }

        const browserProvider = new BrowserProvider(window.ethereum!);
        const walletSigner = await browserProvider.getSigner();
        const walletAddress = await walletSigner.getAddress();
        const network = await browserProvider.getNetwork();

        if (!cancelled) {
          setProvider(browserProvider);
          setSigner(walletSigner);
          setAddress(walletAddress);
          setChainId(Number(network.chainId));
          setIsSessionLoading(false);
        }
      } catch {
        // Silent reconnect failed — user will need to click Connect Wallet
        if (!cancelled) setIsSessionLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jwt, address]);

  const setJwt = useCallback((token: string | null) => {
    setJwtState(token);
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem(JWT_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(JWT_STORAGE_KEY);
      }
    }
  }, []);

  // Build contract instances when signer changes
  const credentialNFT = useMemo(() => {
    if (!signer) return null;
    try {
      const addresses = getContractAddresses();
      return new Contract(
        addresses.credentialNFT,
        CredentialNFTArtifact.abi,
        signer
      );
    } catch {
      return null;
    }
  }, [signer]);

  const reputationToken = useMemo(() => {
    if (!signer) return null;
    try {
      const addresses = getContractAddresses();
      return new Contract(
        addresses.reputationToken,
        ReputationTokenArtifact.abi,
        signer
      );
    } catch {
      return null;
    }
  }, [signer]);

  const connectWallet = useCallback(async () => {
    setError(null);
    setIsConnecting(true);

    try {
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error(
          "MetaMask is not installed. Please install MetaMask to connect your wallet."
        );
      }

      if (!window.ethereum.isMetaMask) {
        throw new Error(
          "MetaMask is not detected. Please make sure MetaMask is your active wallet provider."
        );
      }

      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error(
          "No accounts found. Please unlock MetaMask and try again."
        );
      }

      const browserProvider = new BrowserProvider(window.ethereum);
      const walletSigner = await browserProvider.getSigner();
      const walletAddress = await walletSigner.getAddress();
      const network = await browserProvider.getNetwork();

      setProvider(browserProvider);
      setSigner(walletSigner);
      setAddress(walletAddress);
      setChainId(Number(network.chainId));
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setJwt(null);
    setError(null);
  }, [setJwt]);

  // Listen for account and chain changes from MetaMask
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== address) {
        // Re-connect with the new account
        connectWallet();
      }
    };

    const handleChainChanged = (...args: unknown[]) => {
      const hexChainId = args[0] as string;
      const newChainId = parseInt(hexChainId, 16);
      setChainId(newChainId);

      // Re-create provider and signer for the new chain
      if (window.ethereum) {
        const browserProvider = new BrowserProvider(window.ethereum);
        setProvider(browserProvider);
        browserProvider.getSigner().then((walletSigner) => {
          setSigner(walletSigner);
        }).catch(() => {
          // If signer retrieval fails, clear signer
          setSigner(null);
        });
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [address, connectWallet, disconnectWallet]);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      provider,
      signer,
      credentialNFT,
      reputationToken,
      chainId,
      jwt,
      setJwt,
      isConnecting,
      isSessionLoading,
      error,
      connectWallet,
      disconnectWallet,
    }),
    [
      address,
      provider,
      signer,
      credentialNFT,
      reputationToken,
      chainId,
      jwt,
      setJwt,
      isConnecting,
      isSessionLoading,
      error,
      connectWallet,
      disconnectWallet,
    ]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // MetaMask user rejection
    if (
      "code" in err &&
      (err as { code: number }).code === 4001
    ) {
      return "Connection request was rejected. Please approve the connection in MetaMask to continue.";
    }
    return err.message;
  }
  return "An unexpected error occurred while connecting your wallet. Please try again.";
}
