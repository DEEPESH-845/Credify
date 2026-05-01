/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation
const mockParams = { address: "0x1234567890abcdef1234567890abcdef12345678" };
jest.mock("next/navigation", () => ({
  useParams: () => mockParams,
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
  }),
}));

// Mock next/link
jest.mock("next/link", () => {
  return ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
});

// Mock the API module
const mockGetProfile = jest.fn();
jest.mock("@/lib/api", () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
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
const mockGetHolderCredentials = jest.fn();
const mockGetCredential = jest.fn();
const mockBalanceOf = jest.fn();

let mockWalletState: Record<string, unknown> = {};

jest.mock("@/contexts/WalletContext", () => ({
  useWallet: () => mockWalletState,
}));

// Mock TransactionContext
jest.mock("@/contexts/TransactionContext", () => ({
  useTransactionToast: () => ({
    showLoading: jest.fn().mockReturnValue("toast-1"),
    showSuccess: jest.fn().mockReturnValue("toast-2"),
    showError: jest.fn().mockReturnValue("toast-3"),
    updateToast: jest.fn(),
    dismissToast: jest.fn(),
    dismissAll: jest.fn(),
  }),
}));

import ProfilePage from "@/app/profile/[address]/page";

const sampleProfile = {
  id: 1,
  wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
  display_name: "Alice",
  headline: "Blockchain Developer",
  bio: "Building the future of decentralized identity.",
  location: "San Francisco, CA",
  profile_image_cid: null,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

describe("ProfilePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletState = {
      address: "0xabc",
      jwt: "test-jwt",
      credentialNFT: {
        getHolderCredentials: mockGetHolderCredentials,
        getCredential: mockGetCredential,
      },
      reputationToken: {
        balanceOf: mockBalanceOf,
      },
    };
    mockGetProfile.mockResolvedValue(sampleProfile);
    mockGetHolderCredentials.mockResolvedValue([]);
    mockBalanceOf.mockResolvedValue(BigInt(100));
  });

  it("shows loading state initially", () => {
    // Make the profile fetch hang
    mockGetProfile.mockReturnValue(new Promise(() => {}));
    render(<ProfilePage />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading profile...")).toBeInTheDocument();
  });

  it("displays profile data after loading", async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    expect(screen.getByText("Blockchain Developer")).toBeInTheDocument();
    expect(screen.getByText("San Francisco, CA")).toBeInTheDocument();
    expect(
      screen.getByText("Building the future of decentralized identity.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("0x1234567890abcdef1234567890abcdef12345678")
    ).toBeInTheDocument();
  });

  it("displays reputation token balance", async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    expect(screen.getByText("Reputation Tokens")).toBeInTheDocument();
  });

  it("displays credentials when available", async () => {
    mockGetHolderCredentials.mockResolvedValue([BigInt(1)]);
    mockGetCredential.mockResolvedValue({
      credentialType: "Bachelor of Science",
      issuer: "0xIssuerAddress",
      holder: mockParams.address,
      issuanceTimestamp: BigInt(1704067200),
      ipfsCID: "QmTestCID123",
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Bachelor of Science")).toBeInTheDocument();
    });

    expect(screen.getByText(/Issuer: 0xIssuerAddress/)).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("View Document")).toBeInTheDocument();
  });

  it("shows 'No credentials found' when holder has none", async () => {
    mockGetHolderCredentials.mockResolvedValue([]);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("No credentials found")).toBeInTheDocument();
    });
  });

  it("displays error message on API failure", async () => {
    const { ApiRequestError } = jest.requireMock("@/lib/api");
    mockGetProfile.mockRejectedValue(
      new ApiRequestError(404, "NOT_FOUND", "Profile not found")
    );

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Profile not found")).toBeInTheDocument();
    });
  });

  it("shows default avatar when no profile image CID", async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Default avatar")).toBeInTheDocument();
  });

  it("shows profile image when CID is present", async () => {
    mockGetProfile.mockResolvedValue({
      ...sampleProfile,
      profile_image_cid: "QmImageCID123",
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    const img = screen.getByAltText("Alice profile photo");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      "src",
      "https://ipfs.io/ipfs/QmImageCID123"
    );
  });

  it("fetches profile with correct address and jwt", async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledWith(
        "0x1234567890abcdef1234567890abcdef12345678",
        "test-jwt"
      );
    });
  });

  it("shows 'Back to Feed' link for all authenticated users", async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    const backLink = screen.getByText("← Back to Feed");
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest("a")).toHaveAttribute("href", "/feed");
  });

  it("shows 'Edit Profile' button when viewing own profile (case-insensitive)", async () => {
    mockWalletState = {
      ...mockWalletState,
      address: "0x1234567890ABCDEF1234567890ABCDEF12345678",
    };

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    const editLink = screen.getByText("Edit Profile");
    expect(editLink).toBeInTheDocument();
    expect(editLink.closest("a")).toHaveAttribute("href", "/profile/edit");
  });

  it("does not show 'Edit Profile' button when viewing another user's profile", async () => {
    mockWalletState = {
      ...mockWalletState,
      address: "0xDIFFERENTADDRESS",
    };

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    expect(screen.queryByText("Edit Profile")).not.toBeInTheDocument();
  });

  it("shows ErrorState with retry on API failure", async () => {
    const { ApiRequestError } = jest.requireMock("@/lib/api");
    mockGetProfile.mockRejectedValue(
      new ApiRequestError(500, "SERVER_ERROR", "Server error")
    );

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });

    // ErrorState should render a Retry button
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("uses skeleton loading instead of spinner", () => {
    mockGetProfile.mockReturnValue(new Promise(() => {}));
    render(<ProfilePage />);

    // Should have skeleton elements (animate-pulse divs)
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    // Skeleton elements are rendered inside the status container
    const skeletons = status.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows profile image alt text with truncated address when no display name", async () => {
    mockGetProfile.mockResolvedValue({
      ...sampleProfile,
      display_name: null,
      profile_image_cid: "QmImageCID123",
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Unnamed User")).toBeInTheDocument();
    });

    const img = screen.getByAltText("0x1234…5678 profile photo");
    expect(img).toBeInTheDocument();
  });
});
