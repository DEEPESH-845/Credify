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
const mockGetFeed = jest.fn();
const mockCreatePost = jest.fn();
const mockDeletePost = jest.fn();

jest.mock("@/lib/api", () => ({
  getFeed: (...args: unknown[]) => mockGetFeed(...args),
  createPost: (...args: unknown[]) => mockCreatePost(...args),
  deletePost: (...args: unknown[]) => mockDeletePost(...args),
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

import FeedPage from "@/app/feed/page";

const emptyFeedResponse = {
  posts: [],
  total: 0,
  page: 1,
  limit: 10,
};

const samplePosts = {
  posts: [
    {
      id: 1,
      author_address: "0xabc",
      content: "Hello blockchain world!",
      created_at: "2024-01-02T12:00:00.000Z",
    },
    {
      id: 2,
      author_address: "0xdef",
      content: "Excited about Web3 development",
      created_at: "2024-01-01T10:00:00.000Z",
    },
  ],
  total: 2,
  page: 1,
  limit: 10,
};

describe("FeedPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletState = {
      address: "0xabc",
      jwt: "test-jwt",
    };
    mockGetFeed.mockResolvedValue(emptyFeedResponse);
  });

  it("redirects to /login when not authenticated", () => {
    mockWalletState = { address: null, jwt: null };
    render(<FeedPage />);
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("shows loading state initially", () => {
    mockGetFeed.mockReturnValue(new Promise(() => {}));
    render(<FeedPage />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading feed...")).toBeInTheDocument();
  });

  it("displays empty state when there are no posts", async () => {
    render(<FeedPage />);
    await waitFor(() => {
      expect(
        screen.getByText("No posts yet. Be the first to share something!")
      ).toBeInTheDocument();
    });
  });

  it("displays posts with author address, content, and timestamp", async () => {
    mockGetFeed.mockResolvedValue(samplePosts);
    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText("Hello blockchain world!")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Excited about Web3 development")
    ).toBeInTheDocument();
    expect(screen.getByText("0xabc")).toBeInTheDocument();
    expect(screen.getByText("0xdef")).toBeInTheDocument();
  });

  it("shows delete button only on own posts", async () => {
    mockGetFeed.mockResolvedValue(samplePosts);
    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText("Hello blockchain world!")).toBeInTheDocument();
    });

    // Should have a delete button for post by 0xabc (own post)
    expect(screen.getByLabelText("Delete post 1")).toBeInTheDocument();
    // Should NOT have a delete button for post by 0xdef (other user's post)
    expect(screen.queryByLabelText("Delete post 2")).not.toBeInTheDocument();
  });

  it("creates a new post successfully", async () => {
    mockCreatePost.mockResolvedValue({
      id: 3,
      author_address: "0xabc",
      content: "My new post",
      created_at: "2024-01-03T00:00:00.000Z",
    });

    render(<FeedPage />);

    await waitFor(() => {
      expect(
        screen.getByText("No posts yet. Be the first to share something!")
      ).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("What's on your mind?");
    const postButton = screen.getByRole("button", { name: /^post$/i });

    await act(async () => {
      await userEvent.type(textarea, "My new post");
    });

    await act(async () => {
      await userEvent.click(postButton);
    });

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledWith("My new post", "test-jwt");
    });
  });

  it("shows character counter", async () => {
    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText("0/5000")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("What's on your mind?");

    await act(async () => {
      await userEvent.type(textarea, "Hello");
    });

    expect(screen.getByText("5/5000")).toBeInTheDocument();
  });

  it("disables post button when textarea is empty", async () => {
    render(<FeedPage />);

    await waitFor(() => {
      expect(
        screen.getByText("No posts yet. Be the first to share something!")
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /^post$/i })).toBeDisabled();
  });

  it("deletes own post successfully", async () => {
    mockGetFeed.mockResolvedValue(samplePosts);
    mockDeletePost.mockResolvedValue(undefined);

    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText("Hello blockchain world!")).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByLabelText("Delete post 1"));
    });

    await waitFor(() => {
      expect(mockDeletePost).toHaveBeenCalledWith(1, "test-jwt");
    });
  });

  it("displays error when creating post fails", async () => {
    const { ApiRequestError } = jest.requireMock("@/lib/api");
    mockCreatePost.mockRejectedValue(
      new ApiRequestError(400, "VALIDATION_ERROR", "Content is required")
    );

    render(<FeedPage />);

    await waitFor(() => {
      expect(
        screen.getByText("No posts yet. Be the first to share something!")
      ).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("What's on your mind?");
    const postButton = screen.getByRole("button", { name: /^post$/i });

    await act(async () => {
      await userEvent.type(textarea, "Test post");
    });

    await act(async () => {
      await userEvent.click(postButton);
    });

    await waitFor(() => {
      expect(screen.getByText("Content is required")).toBeInTheDocument();
    });
  });

  it("displays error when fetching feed fails", async () => {
    const { ApiRequestError } = jest.requireMock("@/lib/api");
    mockGetFeed.mockRejectedValue(
      new ApiRequestError(500, "INTERNAL_ERROR", "Server error")
    );

    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });

  it("shows pagination controls when there are multiple pages", async () => {
    mockGetFeed.mockResolvedValue({
      ...samplePosts,
      total: 25,
    });

    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText("Hello blockchain world!")).toBeInTheDocument();
    });

    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeDisabled();
    expect(screen.getByText("Next")).not.toBeDisabled();
  });

  it("navigates to next page when Next is clicked", async () => {
    mockGetFeed.mockResolvedValue({
      ...samplePosts,
      total: 25,
    });

    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText("Hello blockchain world!")).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByText("Next"));
    });

    await waitFor(() => {
      expect(mockGetFeed).toHaveBeenCalledWith("test-jwt", 2, 10);
    });
  });

  it("renders the create post form", async () => {
    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText("Create Post")).toBeInTheDocument();
    });

    expect(
      screen.getByPlaceholderText("What's on your mind?")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^post$/i })).toBeInTheDocument();
  });

  it("displays error when deleting post fails", async () => {
    const { ApiRequestError } = jest.requireMock("@/lib/api");
    mockGetFeed.mockResolvedValue(samplePosts);
    mockDeletePost.mockRejectedValue(
      new ApiRequestError(403, "FORBIDDEN", "Not authorized to delete this post")
    );

    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText("Hello blockchain world!")).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByLabelText("Delete post 1"));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Not authorized to delete this post")
      ).toBeInTheDocument();
    });
  });

  it("hides pagination when only one page of results", async () => {
    mockGetFeed.mockResolvedValue(samplePosts);
    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText("Hello blockchain world!")).toBeInTheDocument();
    });

    expect(screen.queryByText("Previous")).not.toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });
});
