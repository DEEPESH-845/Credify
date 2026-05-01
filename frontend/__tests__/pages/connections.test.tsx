/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

// Mock next/navigation
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
  }),
}));

// Mock the API module
const mockGetConnections = jest.fn();
const mockGetPendingConnections = jest.fn();
const mockSendConnectionRequest = jest.fn();
const mockAcceptConnection = jest.fn();
const mockDeclineConnection = jest.fn();

jest.mock("@/lib/api", () => ({
  getConnections: (...args: unknown[]) => mockGetConnections(...args),
  getPendingConnections: (...args: unknown[]) =>
    mockGetPendingConnections(...args),
  sendConnectionRequest: (...args: unknown[]) =>
    mockSendConnectionRequest(...args),
  acceptConnection: (...args: unknown[]) => mockAcceptConnection(...args),
  declineConnection: (...args: unknown[]) => mockDeclineConnection(...args),
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

import ConnectionsPage from "@/app/connections/page";

const emptyConnectionsResponse = {
  connections: [],
  total: 0,
  page: 1,
  limit: 10,
};

const sampleConnections = {
  connections: [
    {
      id: 1,
      requester_address: "0xabc",
      recipient_address: "0xdef",
      status: "accepted" as const,
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      profile: {
        wallet_address: "0xdef",
        display_name: "Bob",
        headline: "Smart Contract Developer",
        profile_image_cid: null,
      },
    },
    {
      id: 2,
      requester_address: "0x111",
      recipient_address: "0xabc",
      status: "accepted" as const,
      created_at: "2024-01-02T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
      profile: {
        wallet_address: "0x111",
        display_name: "Charlie",
        headline: "DeFi Researcher",
        profile_image_cid: "QmImageCID",
      },
    },
  ],
  total: 2,
  page: 1,
  limit: 10,
};

const samplePendingRequests = {
  connections: [
    {
      id: 10,
      requester_address: "0xpending1",
      recipient_address: "0xabc",
      status: "pending" as const,
      created_at: "2024-01-03T00:00:00.000Z",
      updated_at: "2024-01-03T00:00:00.000Z",
      profile: {
        wallet_address: "0xpending1",
        display_name: "Diana",
        headline: "Blockchain Architect",
        profile_image_cid: null,
      },
    },
  ],
  total: 1,
  page: 1,
  limit: 10,
};

describe("ConnectionsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletState = {
      address: "0xabc",
      jwt: "test-jwt",
      isSessionLoading: false,
    };
    mockGetConnections.mockResolvedValue(emptyConnectionsResponse);
    mockGetPendingConnections.mockResolvedValue(emptyConnectionsResponse);
  });

  it("redirects to /login when not authenticated", () => {
    mockWalletState = { address: null, jwt: null, isSessionLoading: false };
    render(<ConnectionsPage />);
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("shows skeleton loading state initially", () => {
    mockGetConnections.mockReturnValue(new Promise(() => {}));
    render(<ConnectionsPage />);
    // Skeleton loading state — 3 skeleton connection items are rendered
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("displays 'No connections yet' when there are no connections", async () => {
    render(<ConnectionsPage />);
    await waitFor(() => {
      expect(screen.getByText("No connections yet.")).toBeInTheDocument();
    });
  });

  it("displays accepted connections with profile data", async () => {
    mockGetConnections.mockResolvedValue(sampleConnections);
    render(<ConnectionsPage />);

    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    expect(screen.getByText("Smart Contract Developer")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("DeFi Researcher")).toBeInTheDocument();
  });

  it("renders accepted connections as clickable profile links", async () => {
    mockGetConnections.mockResolvedValue(sampleConnections);
    render(<ConnectionsPage />);

    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    const bobLink = screen.getByText("Bob").closest("a");
    expect(bobLink).toHaveAttribute("href", "/profile/0xdef");

    const charlieLink = screen.getByText("Charlie").closest("a");
    expect(charlieLink).toHaveAttribute("href", "/profile/0x111");
  });

  it("displays pending requests with accept/decline buttons", async () => {
    mockGetPendingConnections.mockResolvedValue(samplePendingRequests);
    render(<ConnectionsPage />);

    await waitFor(() => {
      expect(screen.getByText("Pending Requests")).toBeInTheDocument();
    });

    expect(screen.getByText("Diana")).toBeInTheDocument();
    expect(screen.getByText("Blockchain Architect")).toBeInTheDocument();
    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Decline")).toBeInTheDocument();
  });

  it("renders pending request requester as a clickable profile link", async () => {
    mockGetPendingConnections.mockResolvedValue(samplePendingRequests);
    render(<ConnectionsPage />);

    await waitFor(() => {
      expect(screen.getByText("Diana")).toBeInTheDocument();
    });

    const dianaLink = screen.getByText("Diana").closest("a");
    expect(dianaLink).toHaveAttribute("href", "/profile/0xpending1");
  });

  it("hides pending section when there are no pending requests", async () => {
    render(<ConnectionsPage />);
    await waitFor(() => {
      expect(screen.getByText("No connections yet.")).toBeInTheDocument();
    });
    expect(screen.queryByText("Pending Requests")).not.toBeInTheDocument();
  });

  it("sends a connection request successfully", async () => {
    mockSendConnectionRequest.mockResolvedValue({
      id: 99,
      requester_address: "0xabc",
      recipient_address: "0xnewuser",
      status: "pending",
    });

    render(<ConnectionsPage />);

    await waitFor(() => {
      expect(screen.getByText("No connections yet.")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Enter wallet address (0x...)");
    const button = screen.getByRole("button", { name: /send request/i });

    await act(async () => {
      await userEvent.type(input, "0xnewuser");
    });

    await act(async () => {
      await userEvent.click(button);
    });

    await waitFor(() => {
      expect(mockSendConnectionRequest).toHaveBeenCalledWith(
        "0xnewuser",
        "test-jwt"
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText("Connection request sent to 0xnewuser")
      ).toBeInTheDocument();
    });
  });

  it("displays error when sending connection request fails", async () => {
    const { ApiRequestError } = jest.requireMock("@/lib/api");
    mockSendConnectionRequest.mockRejectedValue(
      new ApiRequestError(
        409,
        "DUPLICATE_CONNECTION",
        "A connection request already exists"
      )
    );

    render(<ConnectionsPage />);

    await waitFor(() => {
      expect(screen.getByText("No connections yet.")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Enter wallet address (0x...)");
    const button = screen.getByRole("button", { name: /send request/i });

    await act(async () => {
      await userEvent.type(input, "0xexisting");
    });

    await act(async () => {
      await userEvent.click(button);
    });

    await waitFor(() => {
      expect(
        screen.getByText("A connection request already exists")
      ).toBeInTheDocument();
    });
  });

  it("accepts a pending connection request", async () => {
    mockGetPendingConnections.mockResolvedValue(samplePendingRequests);
    mockAcceptConnection.mockResolvedValue({
      ...samplePendingRequests.connections[0],
      status: "accepted",
    });
    // After accepting, refresh returns the new connection
    mockGetConnections
      .mockResolvedValueOnce(emptyConnectionsResponse)
      .mockResolvedValueOnce({
        connections: [
          {
            ...samplePendingRequests.connections[0],
            status: "accepted",
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      });

    render(<ConnectionsPage />);

    await waitFor(() => {
      expect(screen.getByText("Diana")).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByText("Accept"));
    });

    await waitFor(() => {
      expect(mockAcceptConnection).toHaveBeenCalledWith(10, "test-jwt");
    });
  });

  it("declines a pending connection request", async () => {
    mockGetPendingConnections.mockResolvedValue(samplePendingRequests);
    mockDeclineConnection.mockResolvedValue({
      ...samplePendingRequests.connections[0],
      status: "declined",
    });

    render(<ConnectionsPage />);

    await waitFor(() => {
      expect(screen.getByText("Diana")).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByText("Decline"));
    });

    await waitFor(() => {
      expect(mockDeclineConnection).toHaveBeenCalledWith(10, "test-jwt");
    });
  });

  it("displays error when fetching connections fails", async () => {
    const { ApiRequestError } = jest.requireMock("@/lib/api");
    mockGetConnections.mockRejectedValue(
      new ApiRequestError(500, "INTERNAL_ERROR", "Server error")
    );

    render(<ConnectionsPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });

  it("shows pagination controls when there are multiple pages", async () => {
    mockGetConnections.mockResolvedValue({
      ...sampleConnections,
      total: 25,
    });

    render(<ConnectionsPage />);

    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeDisabled();
    expect(screen.getByText("Next")).not.toBeDisabled();
  });

  it("navigates to next page when Next is clicked", async () => {
    mockGetConnections.mockResolvedValue({
      ...sampleConnections,
      total: 25,
    });

    render(<ConnectionsPage />);

    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByText("Next"));
    });

    await waitFor(() => {
      expect(mockGetConnections).toHaveBeenCalledWith("test-jwt", 2, 10);
    });
  });

  it("renders the send request form", async () => {
    render(<ConnectionsPage />);

    await waitFor(() => {
      expect(screen.getByText("Send Connection Request")).toBeInTheDocument();
    });

    expect(
      screen.getByPlaceholderText("Enter wallet address (0x...)")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send request/i })
    ).toBeInTheDocument();
  });

  it("disables send button when input is empty", async () => {
    render(<ConnectionsPage />);

    await waitFor(() => {
      expect(screen.getByText("No connections yet.")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /send request/i })
    ).toBeDisabled();
  });

  it("shows profile image when CID is present in connection", async () => {
    mockGetConnections.mockResolvedValue(sampleConnections);
    render(<ConnectionsPage />);

    await waitFor(() => {
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });

    const img = screen.getByAltText("Charlie profile photo");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://ipfs.io/ipfs/QmImageCID");
  });
});
