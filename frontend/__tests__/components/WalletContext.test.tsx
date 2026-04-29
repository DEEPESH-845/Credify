/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WalletProvider, useWallet } from "@/contexts/WalletContext";

// Mock the contracts-config module
jest.mock("@/lib/contracts-config", () => ({
  getContractAddresses: () => ({
    credentialNFT: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    reputationToken: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  }),
}));

// Mock the contract artifacts
jest.mock(
  "../../../contracts/artifacts/contracts/CredentialNFT.sol/CredentialNFT.json",
  () => ({ abi: [] }),
  { virtual: true }
);
jest.mock(
  "../../../contracts/artifacts/contracts/ReputationToken.sol/ReputationToken.json",
  () => ({ abi: [] }),
  { virtual: true }
);

// Helper component to expose context values for testing
function TestConsumer() {
  const wallet = useWallet();
  return (
    <div>
      <span data-testid="address">{wallet.address ?? "null"}</span>
      <span data-testid="jwt">{wallet.jwt ?? "null"}</span>
      <span data-testid="isConnecting">
        {wallet.isConnecting ? "true" : "false"}
      </span>
      <span data-testid="error">{wallet.error ?? "null"}</span>
      <button data-testid="connect" onClick={wallet.connectWallet}>
        Connect
      </button>
      <button data-testid="disconnect" onClick={wallet.disconnectWallet}>
        Disconnect
      </button>
      <button
        data-testid="set-jwt"
        onClick={() => wallet.setJwt("test-token")}
      >
        Set JWT
      </button>
      <button data-testid="clear-jwt" onClick={() => wallet.setJwt(null)}>
        Clear JWT
      </button>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const windowAny = window as any;

describe("WalletProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    delete windowAny.ethereum;
  });

  it("renders children and provides default context values", () => {
    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    expect(screen.getByTestId("address")).toHaveTextContent("null");
    expect(screen.getByTestId("jwt")).toHaveTextContent("null");
    expect(screen.getByTestId("isConnecting")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent("null");
  });

  it("shows error when MetaMask is not installed", async () => {
    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    await act(async () => {
      screen.getByTestId("connect").click();
    });

    expect(screen.getByTestId("error")).toHaveTextContent(
      "MetaMask is not installed"
    );
    expect(screen.getByTestId("address")).toHaveTextContent("null");
  });

  it("shows error when user rejects connection", async () => {
    const rejectionError = Object.assign(new Error("User rejected"), {
      code: 4001,
    });

    windowAny.ethereum = {
      isMetaMask: true,
      request: jest.fn().mockRejectedValue(rejectionError),
      on: jest.fn(),
      removeListener: jest.fn(),
    };

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    await act(async () => {
      screen.getByTestId("connect").click();
    });

    expect(screen.getByTestId("error")).toHaveTextContent(
      "Connection request was rejected"
    );
  });

  it("stores and clears JWT in state and localStorage", async () => {
    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    // Set JWT
    await act(async () => {
      screen.getByTestId("set-jwt").click();
    });

    expect(screen.getByTestId("jwt")).toHaveTextContent("test-token");
    expect(localStorage.getItem("bsn_jwt")).toBe("test-token");

    // Clear JWT
    await act(async () => {
      screen.getByTestId("clear-jwt").click();
    });

    expect(screen.getByTestId("jwt")).toHaveTextContent("null");
    expect(localStorage.getItem("bsn_jwt")).toBeNull();
  });

  it("loads JWT from localStorage on mount", () => {
    localStorage.setItem("bsn_jwt", "stored-token");

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    expect(screen.getByTestId("jwt")).toHaveTextContent("stored-token");
  });

  it("disconnects wallet and clears all state", async () => {
    localStorage.setItem("bsn_jwt", "some-token");

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    // First set JWT so we can verify it gets cleared
    await act(async () => {
      screen.getByTestId("set-jwt").click();
    });

    await act(async () => {
      screen.getByTestId("disconnect").click();
    });

    expect(screen.getByTestId("address")).toHaveTextContent("null");
    expect(screen.getByTestId("jwt")).toHaveTextContent("null");
    expect(screen.getByTestId("error")).toHaveTextContent("null");
    expect(localStorage.getItem("bsn_jwt")).toBeNull();
  });

  it("connects wallet successfully when MetaMask is available", async () => {
    const mockAddress = "0x1234567890abcdef1234567890abcdef12345678";

    windowAny.ethereum = {
      isMetaMask: true,
      request: jest.fn().mockResolvedValue([mockAddress]),
      on: jest.fn(),
      removeListener: jest.fn(),
    };

    // Mock ethers BrowserProvider and Signer
    const mockSigner = {
      getAddress: jest.fn().mockResolvedValue(mockAddress),
    };

    jest
      .spyOn(require("ethers"), "BrowserProvider")
      .mockImplementation(() => ({
        getSigner: jest.fn().mockResolvedValue(mockSigner),
      }));

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    await act(async () => {
      screen.getByTestId("connect").click();
    });

    expect(screen.getByTestId("address")).toHaveTextContent(mockAddress);
    expect(screen.getByTestId("error")).toHaveTextContent("null");
    expect(screen.getByTestId("isConnecting")).toHaveTextContent("false");
  });
});
