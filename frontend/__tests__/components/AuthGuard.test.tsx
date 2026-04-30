/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AuthGuard from "@/components/AuthGuard";

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

// Mock WalletContext
let mockJwt: string | null = null;
jest.mock("@/contexts/WalletContext", () => ({
  useWallet: () => ({
    jwt: mockJwt,
    address: null,
    provider: null,
    signer: null,
    credentialNFT: null,
    reputationToken: null,
    setJwt: jest.fn(),
    isConnecting: false,
    error: null,
    connectWallet: jest.fn(),
    disconnectWallet: jest.fn(),
  }),
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    mockJwt = null;
    mockReplace.mockClear();
  });

  it("redirects to /login when jwt is null", () => {
    mockJwt = null;

    render(
      <AuthGuard>
        <div data-testid="protected">Protected Content</div>
      </AuthGuard>
    );

    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });

  it("shows a loading spinner when jwt is null", () => {
    mockJwt = null;

    render(
      <AuthGuard>
        <div data-testid="protected">Protected Content</div>
      </AuthGuard>
    );

    const spinner = screen.getByRole("status");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute("aria-label", "Loading");
  });

  it("renders children when jwt is present", () => {
    mockJwt = "valid-jwt-token";

    render(
      <AuthGuard>
        <div data-testid="protected">Protected Content</div>
      </AuthGuard>
    );

    expect(screen.getByTestId("protected")).toBeInTheDocument();
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not show spinner when jwt is present", () => {
    mockJwt = "valid-jwt-token";

    render(
      <AuthGuard>
        <div>Content</div>
      </AuthGuard>
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
