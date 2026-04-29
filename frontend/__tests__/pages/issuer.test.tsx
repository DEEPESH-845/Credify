/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
  }),
}));

// Mock WalletContext
const mockMintCredential = jest.fn();
const mockParseLog = jest.fn();

let mockWalletState: Record<string, unknown> = {};

jest.mock("@/contexts/WalletContext", () => ({
  useWallet: () => mockWalletState,
}));

// Mock api module
const mockUploadFile = jest.fn();
jest.mock("@/lib/api", () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
  ApiRequestError: class ApiRequestError extends Error {
    public status: number;
    public code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.name = "ApiRequestError";
      this.status = status;
      this.code = code;
    }
  },
}));

import IssuerDashboardPage from "@/app/issuer/page";

const VALID_HOLDER = "0x1234567890abcdef1234567890abcdef12345678";

function createMockFile(name = "degree.pdf", type = "application/pdf"): File {
  return new File(["pdf-content"], name, { type });
}

describe("IssuerDashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockMintCredential.mockResolvedValue({
      wait: jest.fn().mockResolvedValue({
        logs: [
          {
            topics: ["0xevent"],
            data: "0xdata",
          },
        ],
      }),
    });

    mockParseLog.mockReturnValue({
      name: "CredentialIssued",
      args: { tokenId: BigInt(42) },
    });

    mockWalletState = {
      address: "0xIssuerAddress",
      jwt: "mock-jwt-token",
      credentialNFT: {
        mintCredential: mockMintCredential,
        interface: {
          parseLog: mockParseLog,
        },
      },
    };

    mockUploadFile.mockResolvedValue({ cid: "QmTestCID123" });
  });

  it("renders the issuer dashboard header", () => {
    render(<IssuerDashboardPage />);

    expect(screen.getByText("Issuer Dashboard")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Issue verifiable credentials as NFTs on the blockchain."
      )
    ).toBeInTheDocument();
  });

  it("renders the form with all required fields", () => {
    render(<IssuerDashboardPage />);

    expect(screen.getByLabelText("Holder Wallet Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Credential Type")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Credential Document (PDF)")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Issue Credential" })
    ).toBeInTheDocument();
  });

  it("shows error when wallet is not connected", async () => {
    mockWalletState = {
      address: null,
      jwt: null,
      credentialNFT: null,
    };

    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please connect your wallet and authenticate first."
    );
  });

  it("shows error when holder address is empty", async () => {
    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Holder wallet address is required."
    );
  });

  it("shows error for invalid holder address format", async () => {
    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.type(
      screen.getByLabelText("Holder Wallet Address"),
      "not-an-address"
    );
    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid holder wallet address. Must be a valid Ethereum address."
    );
  });

  it("shows error when credential type is empty", async () => {
    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.type(
      screen.getByLabelText("Holder Wallet Address"),
      VALID_HOLDER
    );
    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Credential type is required."
    );
  });

  it("shows error when no document file is selected", async () => {
    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.type(
      screen.getByLabelText("Holder Wallet Address"),
      VALID_HOLDER
    );
    await user.type(
      screen.getByLabelText("Credential Type"),
      "Bachelor of Science"
    );
    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please select a credential document (PDF) to upload."
    );
  });

  it("shows loading indicator during IPFS upload", async () => {
    // Make uploadFile hang so we can observe the loading state
    mockUploadFile.mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.type(
      screen.getByLabelText("Holder Wallet Address"),
      VALID_HOLDER
    );
    await user.type(
      screen.getByLabelText("Credential Type"),
      "Bachelor of Science"
    );

    const fileInput = screen.getByLabelText("Credential Document (PDF)");
    await user.upload(fileInput, createMockFile());

    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Uploading document to IPFS...")
    ).toBeInTheDocument();
  });

  it("shows loading indicator during blockchain transaction", async () => {
    // Upload resolves immediately, but mint hangs
    mockMintCredential.mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.type(
      screen.getByLabelText("Holder Wallet Address"),
      VALID_HOLDER
    );
    await user.type(
      screen.getByLabelText("Credential Type"),
      "Bachelor of Science"
    );

    const fileInput = screen.getByLabelText("Credential Document (PDF)");
    await user.upload(fileInput, createMockFile());

    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Submitting transaction to blockchain...")
      ).toBeInTheDocument();
    });
  });

  it("shows success confirmation with token ID after successful issuance", async () => {
    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.type(
      screen.getByLabelText("Holder Wallet Address"),
      VALID_HOLDER
    );
    await user.type(
      screen.getByLabelText("Credential Type"),
      "Bachelor of Science"
    );

    const fileInput = screen.getByLabelText("Credential Document (PDF)");
    await user.upload(fileInput, createMockFile());

    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Credential Issued Successfully")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(VALID_HOLDER)).toBeInTheDocument();
    expect(screen.getByText("Bachelor of Science")).toBeInTheDocument();
    expect(screen.getByText("QmTestCID123")).toBeInTheDocument();
  });

  it("calls uploadFile with the correct arguments", async () => {
    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.type(
      screen.getByLabelText("Holder Wallet Address"),
      VALID_HOLDER
    );
    await user.type(
      screen.getByLabelText("Credential Type"),
      "Bachelor of Science"
    );

    const file = createMockFile();
    const fileInput = screen.getByLabelText("Credential Document (PDF)");
    await user.upload(fileInput, file);

    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledWith(file, "mock-jwt-token");
    });
  });

  it("calls mintCredential with correct arguments", async () => {
    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.type(
      screen.getByLabelText("Holder Wallet Address"),
      VALID_HOLDER
    );
    await user.type(
      screen.getByLabelText("Credential Type"),
      "Bachelor of Science"
    );

    const fileInput = screen.getByLabelText("Credential Document (PDF)");
    await user.upload(fileInput, createMockFile());

    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    await waitFor(() => {
      expect(mockMintCredential).toHaveBeenCalledWith(
        VALID_HOLDER,
        "Bachelor of Science",
        "QmTestCID123"
      );
    });
  });

  it("shows error when IPFS upload fails", async () => {
    const { ApiRequestError } = jest.requireMock("@/lib/api");
    mockUploadFile.mockRejectedValue(
      new ApiRequestError(413, "FILE_TOO_LARGE", "File exceeds the maximum allowed size")
    );

    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.type(
      screen.getByLabelText("Holder Wallet Address"),
      VALID_HOLDER
    );
    await user.type(
      screen.getByLabelText("Credential Type"),
      "Bachelor of Science"
    );

    const fileInput = screen.getByLabelText("Credential Document (PDF)");
    await user.upload(fileInput, createMockFile());

    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "File exceeds the maximum allowed size"
      );
    });
  });

  it("shows parsed revert reason when contract call fails", async () => {
    mockMintCredential.mockRejectedValue(
      new Error(
        'execution reverted: reason="CredentialNFT: caller is not an authorized issuer"'
      )
    );

    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.type(
      screen.getByLabelText("Holder Wallet Address"),
      VALID_HOLDER
    );
    await user.type(
      screen.getByLabelText("Credential Type"),
      "Bachelor of Science"
    );

    const fileInput = screen.getByLabelText("Credential Document (PDF)");
    await user.upload(fileInput, createMockFile());

    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "CredentialNFT: caller is not an authorized issuer"
      );
    });
  });

  it("shows rejection message when user rejects transaction", async () => {
    const rejectionError = new Error("User rejected");
    (rejectionError as unknown as { code: string }).code = "ACTION_REJECTED";
    mockMintCredential.mockRejectedValue(rejectionError);

    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.type(
      screen.getByLabelText("Holder Wallet Address"),
      VALID_HOLDER
    );
    await user.type(
      screen.getByLabelText("Credential Type"),
      "Bachelor of Science"
    );

    const fileInput = screen.getByLabelText("Credential Document (PDF)");
    await user.upload(fileInput, createMockFile());

    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Transaction was rejected in your wallet."
      );
    });
  });

  it("allows issuing another credential after success", async () => {
    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.type(
      screen.getByLabelText("Holder Wallet Address"),
      VALID_HOLDER
    );
    await user.type(
      screen.getByLabelText("Credential Type"),
      "Bachelor of Science"
    );

    const fileInput = screen.getByLabelText("Credential Document (PDF)");
    await user.upload(fileInput, createMockFile());

    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Credential Issued Successfully")
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Issue Another Credential" })
    );

    // Form should be visible again with empty fields
    expect(screen.getByLabelText("Holder Wallet Address")).toHaveValue("");
    expect(screen.getByLabelText("Credential Type")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Issue Credential" })
    ).toBeInTheDocument();
  });

  it("disables form fields during loading", async () => {
    mockUploadFile.mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.type(
      screen.getByLabelText("Holder Wallet Address"),
      VALID_HOLDER
    );
    await user.type(
      screen.getByLabelText("Credential Type"),
      "Bachelor of Science"
    );

    const fileInput = screen.getByLabelText("Credential Document (PDF)");
    await user.upload(fileInput, createMockFile());

    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Holder Wallet Address")).toBeDisabled();
      expect(screen.getByLabelText("Credential Type")).toBeDisabled();
      expect(
        screen.getByLabelText("Credential Document (PDF)")
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Processing..." })).toBeDisabled();
    });
  });

  it("shows error when credentialNFT contract is not available", async () => {
    mockWalletState = {
      address: "0xIssuerAddress",
      jwt: "mock-jwt-token",
      credentialNFT: null,
    };

    const user = userEvent.setup();
    render(<IssuerDashboardPage />);

    await user.type(
      screen.getByLabelText("Holder Wallet Address"),
      VALID_HOLDER
    );
    await user.type(
      screen.getByLabelText("Credential Type"),
      "Bachelor of Science"
    );

    const fileInput = screen.getByLabelText("Credential Document (PDF)");
    await user.upload(fileInput, createMockFile());

    await user.click(
      screen.getByRole("button", { name: "Issue Credential" })
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Smart contract is not available. Please check your network connection."
    );
  });
});
