/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock the API module
jest.mock("@/lib/api", () => ({
  requestNonce: jest.fn(),
  verifySignature: jest.fn(),
  ApiRequestError: class ApiRequestError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.name = "ApiRequestError";
      this.status = status;
      this.code = code;
    }
  },
}));

// Mock WalletContext
const mockConnectWallet = jest.fn();
const mockSetJwt = jest.fn();
let mockWalletState = {
  address: null as string | null,
  signer: null as { signMessage: jest.Mock } | null,
  jwt: null as string | null,
  setJwt: mockSetJwt,
  isConnecting: false,
  error: null as string | null,
  connectWallet: mockConnectWallet,
};

jest.mock("@/contexts/WalletContext", () => ({
  useWallet: () => mockWalletState,
}));

import LoginPage from "@/app/login/page";
import { requestNonce, verifySignature } from "@/lib/api";

const mockRequestNonce = requestNonce as jest.MockedFunction<
  typeof requestNonce
>;
const mockVerifySignature = verifySignature as jest.MockedFunction<
  typeof verifySignature
>;

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletState = {
      address: null,
      signer: null,
      jwt: null,
      setJwt: mockSetJwt,
      isConnecting: false,
      error: null,
      connectWallet: mockConnectWallet,
    };
  });

  it("renders the login page with connect button", () => {
    render(<LoginPage />);

    expect(
      screen.getByText("Blockchain Social Network")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Connect your wallet to get started")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /connect wallet/i })
    ).toBeInTheDocument();
  });

  it("redirects to /feed when jwt is already present", () => {
    mockWalletState.jwt = "existing-token";

    render(<LoginPage />);

    expect(mockReplace).toHaveBeenCalledWith("/feed");
  });

  it("calls connectWallet when button is clicked", async () => {
    render(<LoginPage />);

    await act(async () => {
      screen.getByRole("button", { name: /connect wallet/i }).click();
    });

    expect(mockConnectWallet).toHaveBeenCalled();
  });

  it("shows loading state when isConnecting is true", () => {
    mockWalletState.isConnecting = true;

    render(<LoginPage />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /connecting/i })
    ).toBeDisabled();
  });

  it("displays wallet error messages", () => {
    mockWalletState.error = "MetaMask is not installed";

    render(<LoginPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "MetaMask is not installed"
    );
  });

  it("disables button during loading", () => {
    mockWalletState.isConnecting = true;

    render(<LoginPage />);

    expect(
      screen.getByRole("button", { name: /connecting/i })
    ).toBeDisabled();
  });

  describe("connected wallet state", () => {
    beforeEach(() => {
      mockWalletState = {
        address: "0x1234567890abcdef1234567890abcdef12345678",
        signer: { signMessage: jest.fn() },
        jwt: null,
        setJwt: mockSetJwt,
        isConnecting: false,
        error: null,
        connectWallet: mockConnectWallet,
      };
    });

    it("shows Sign In button with truncated address when wallet is connected but no JWT", () => {
      render(<LoginPage />);

      expect(
        screen.getByRole("button", { name: /sign in/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/0x1234…5678/)).toBeInTheDocument();
      expect(screen.getByText(/wallet connected/i)).toBeInTheDocument();
      // Connect Wallet button should NOT be present
      expect(
        screen.queryByRole("button", { name: /connect wallet/i })
      ).not.toBeInTheDocument();
    });

    it("Sign In button triggers auth flow without calling connectWallet", async () => {
      mockRequestNonce.mockResolvedValue({ nonce: "test-nonce" });
      mockWalletState.signer!.signMessage.mockResolvedValue("test-signature");
      mockVerifySignature.mockResolvedValue({
        token: "test-jwt",
        address: mockWalletState.address!,
      });

      render(<LoginPage />);

      await act(async () => {
        screen.getByRole("button", { name: /sign in/i }).click();
      });

      expect(mockConnectWallet).not.toHaveBeenCalled();
      expect(mockRequestNonce).toHaveBeenCalledWith(
        mockWalletState.address
      );
      expect(mockWalletState.signer!.signMessage).toHaveBeenCalledWith(
        "test-nonce"
      );
      expect(mockVerifySignature).toHaveBeenCalledWith(
        mockWalletState.address,
        "test-signature",
        "test-nonce"
      );
      expect(mockSetJwt).toHaveBeenCalledWith("test-jwt");
    });

    it("shows error and re-renders Sign In button on auth failure", async () => {
      mockRequestNonce.mockRejectedValue(new Error("Network error"));

      render(<LoginPage />);

      await act(async () => {
        screen.getByRole("button", { name: /sign in/i }).click();
      });

      // Error should be displayed
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
      // Sign In button should be re-rendered for retry
      expect(
        screen.getByRole("button", { name: /sign in/i })
      ).toBeInTheDocument();
    });
  });
});
