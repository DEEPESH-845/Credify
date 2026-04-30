/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation
const mockParams = { tokenId: "1" };
jest.mock("next/navigation", () => ({
  useParams: () => mockParams,
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
  }),
}));

// Mock WalletContext
const mockGetCredential = jest.fn();

let mockWalletState: Record<string, unknown> = {};

jest.mock("@/contexts/WalletContext", () => ({
  useWallet: () => mockWalletState,
}));

// Mock TransactionContext
const mockShowError = jest.fn().mockReturnValue("toast-err");
jest.mock("@/contexts/TransactionContext", () => ({
  useTransactionToast: () => ({
    showLoading: jest.fn().mockReturnValue("toast-1"),
    showSuccess: jest.fn().mockReturnValue("toast-2"),
    showError: mockShowError,
    updateToast: jest.fn(),
    dismissToast: jest.fn(),
    dismissAll: jest.fn(),
  }),
}));

import CredentialVerificationPage from "@/app/credentials/[tokenId]/page";

const sampleCredential = {
  credentialType: "Bachelor of Science",
  issuer: "0xIssuerAddress1234567890abcdef1234567890ab",
  holder: "0xHolderAddress1234567890abcdef1234567890ab",
  issuanceTimestamp: BigInt(1704067200), // 2024-01-01T00:00:00Z
  ipfsCID: "QmTestCID123456789",
};

describe("CredentialVerificationPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletState = {
      address: "0xabc",
      credentialNFT: {
        getCredential: mockGetCredential,
      },
    };
    mockGetCredential.mockResolvedValue(sampleCredential);
  });

  it("shows loading state initially", () => {
    mockGetCredential.mockReturnValue(new Promise(() => {}));
    render(<CredentialVerificationPage />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Verifying credential on blockchain...")).toBeInTheDocument();
  });

  it("displays credential data after loading", async () => {
    render(<CredentialVerificationPage />);

    await waitFor(() => {
      expect(screen.getByText("Bachelor of Science")).toBeInTheDocument();
    });

    expect(screen.getByText("Credential Verification")).toBeInTheDocument();
    expect(screen.getByText("Token ID: 1")).toBeInTheDocument();
    expect(
      screen.getByText("0xIssuerAddress1234567890abcdef1234567890ab")
    ).toBeInTheDocument();
    expect(
      screen.getByText("0xHolderAddress1234567890abcdef1234567890ab")
    ).toBeInTheDocument();
  });

  it("displays verification status as Verified", async () => {
    render(<CredentialVerificationPage />);

    await waitFor(() => {
      expect(screen.getByText("Bachelor of Science")).toBeInTheDocument();
    });

    const verifiedBadges = screen.getAllByText("Verified");
    expect(verifiedBadges.length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(
        "This credential is recorded on-chain and is tamper-proof."
      )
    ).toBeInTheDocument();
  });

  it("displays issuance date formatted from timestamp", async () => {
    render(<CredentialVerificationPage />);

    await waitFor(() => {
      expect(screen.getByText("Bachelor of Science")).toBeInTheDocument();
    });

    // The date is formatted via toLocaleDateString, so check the element exists
    const issuanceDateDt = screen.getByText("Issuance Date");
    expect(issuanceDateDt).toBeInTheDocument();
  });

  it("displays IPFS document link", async () => {
    render(<CredentialVerificationPage />);

    await waitFor(() => {
      expect(screen.getByText("Bachelor of Science")).toBeInTheDocument();
    });

    const link = screen.getByText("View Document on IPFS");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      "https://ipfs.io/ipfs/QmTestCID123456789"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    expect(screen.getByText("CID: QmTestCID123456789")).toBeInTheDocument();
  });

  it("displays error message on contract call failure", async () => {
    mockGetCredential.mockRejectedValue(new Error("Token does not exist"));

    render(<CredentialVerificationPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Token does not exist"
      );
    });
  });

  it("displays generic error for non-Error exceptions", async () => {
    mockGetCredential.mockRejectedValue("unknown error");

    render(<CredentialVerificationPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "An unexpected error occurred during the transaction."
      );
    });
  });

  it("shows 'Credential not found' when contract is not available", async () => {
    mockWalletState = {
      address: "0xabc",
      credentialNFT: null,
    };

    render(<CredentialVerificationPage />);

    await waitFor(() => {
      expect(screen.getByText("Credential not found")).toBeInTheDocument();
    });
  });

  it("calls getCredential with the correct token ID as BigInt", async () => {
    render(<CredentialVerificationPage />);

    await waitFor(() => {
      expect(mockGetCredential).toHaveBeenCalledWith(BigInt(1));
    });
  });

  it("does not show IPFS section when ipfsCID is empty", async () => {
    mockGetCredential.mockResolvedValue({
      ...sampleCredential,
      ipfsCID: "",
    });

    render(<CredentialVerificationPage />);

    await waitFor(() => {
      expect(screen.getByText("Bachelor of Science")).toBeInTheDocument();
    });

    expect(screen.queryByText("View Document on IPFS")).not.toBeInTheDocument();
    expect(screen.queryByText("Credential Document")).not.toBeInTheDocument();
  });
});
