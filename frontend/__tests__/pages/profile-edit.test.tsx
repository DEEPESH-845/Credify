/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
}));

// Mock the API module
const mockGetProfile = jest.fn();
const mockUpdateProfile = jest.fn();
const mockUploadProfileImage = jest.fn();
jest.mock("@/lib/api", () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  uploadProfileImage: (...args: unknown[]) => mockUploadProfileImage(...args),
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
let mockWalletState: Record<string, unknown> = {};
jest.mock("@/contexts/WalletContext", () => ({
  useWallet: () => mockWalletState,
}));

import ProfileEditPage from "@/app/profile/edit/page";

const sampleProfile = {
  id: 1,
  wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
  display_name: "Alice",
  headline: "Blockchain Developer",
  bio: "Building the future.",
  location: "San Francisco, CA",
  profile_image_cid: null,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

describe("ProfileEditPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletState = {
      address: "0x1234567890abcdef1234567890abcdef12345678",
      jwt: "test-jwt",
    };
    mockGetProfile.mockResolvedValue(sampleProfile);
    mockUpdateProfile.mockResolvedValue(sampleProfile);
  });

  it("redirects to /login when not authenticated", () => {
    mockWalletState = { address: null, jwt: null };
    render(<ProfileEditPage />);
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("shows loading state initially", () => {
    mockGetProfile.mockReturnValue(new Promise(() => {}));
    render(<ProfileEditPage />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading profile...")).toBeInTheDocument();
  });

  it("populates form fields with existing profile data", async () => {
    render(<ProfileEditPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Display Name")).toHaveValue("Alice");
    expect(screen.getByLabelText("Headline")).toHaveValue(
      "Blockchain Developer"
    );
    expect(screen.getByLabelText("Bio")).toHaveValue("Building the future.");
    expect(screen.getByLabelText("Location")).toHaveValue(
      "San Francisco, CA"
    );
  });

  it("shows error message when profile load fails", async () => {
    const { ApiRequestError } = jest.requireMock("@/lib/api");
    mockGetProfile.mockRejectedValue(
      new ApiRequestError(500, "INTERNAL_ERROR", "Server error")
    );

    render(<ProfileEditPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });

  it("validates display name length", async () => {
    render(<ProfileEditPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText("Display Name");
    fireEvent.change(nameInput, { target: { value: "A".repeat(101) } });
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(
        screen.getByText("Display name must be 100 characters or fewer")
      ).toBeInTheDocument();
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("validates headline length", async () => {
    render(<ProfileEditPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Headline")).toBeInTheDocument();
    });

    const headlineInput = screen.getByLabelText("Headline");
    fireEvent.change(headlineInput, { target: { value: "H".repeat(201) } });
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(
        screen.getByText("Headline must be 200 characters or fewer")
      ).toBeInTheDocument();
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("validates location length", async () => {
    render(<ProfileEditPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Location")).toBeInTheDocument();
    });

    const locationInput = screen.getByLabelText("Location");
    fireEvent.change(locationInput, { target: { value: "L".repeat(101) } });
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(
        screen.getByText("Location must be 100 characters or fewer")
      ).toBeInTheDocument();
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("calls updateProfile on valid form submission", async () => {
    render(<ProfileEditPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Display Name"), {
      target: { value: "Bob" },
    });
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        "0x1234567890abcdef1234567890abcdef12345678",
        {
          display_name: "Bob",
          headline: "Blockchain Developer",
          bio: "Building the future.",
          location: "San Francisco, CA",
        },
        "test-jwt"
      );
    });
  });

  it("shows success message after saving", async () => {
    render(<ProfileEditPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(
        screen.getByText("Profile updated successfully")
      ).toBeInTheDocument();
    });
  });

  it("shows error message when save fails", async () => {
    const { ApiRequestError } = jest.requireMock("@/lib/api");
    mockUpdateProfile.mockRejectedValue(
      new ApiRequestError(400, "VALIDATION_ERROR", "Invalid data")
    );

    render(<ProfileEditPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid data");
    });
  });

  it("navigates to profile view on cancel", async () => {
    render(<ProfileEditPage />);

    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancel"));
    expect(mockPush).toHaveBeenCalledWith(
      "/profile/0x1234567890abcdef1234567890abcdef12345678"
    );
  });

  it("shows default avatar when no profile image", async () => {
    render(<ProfileEditPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Default avatar")).toBeInTheDocument();
    });
  });

  it("shows profile image when CID is present", async () => {
    mockGetProfile.mockResolvedValue({
      ...sampleProfile,
      profile_image_cid: "QmImageCID123",
    });

    render(<ProfileEditPage />);

    await waitFor(() => {
      expect(screen.getByAltText("Profile")).toBeInTheDocument();
    });

    const img = screen.getByAltText("Profile");
    expect(img).toHaveAttribute(
      "src",
      "https://ipfs.io/ipfs/QmImageCID123"
    );
  });

  it("displays character counters for limited fields", async () => {
    render(<ProfileEditPage />);

    await waitFor(() => {
      expect(screen.getByText("5/100")).toBeInTheDocument(); // "Alice" = 5 chars
    });

    expect(screen.getByText("20/200")).toBeInTheDocument(); // "Blockchain Developer" = 20 chars
    expect(screen.getByText("17/100")).toBeInTheDocument(); // "San Francisco, CA" = 17 chars
  });
});
