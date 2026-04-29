"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import {
  getFeed,
  createPost,
  deletePost,
  PostData,
  ApiRequestError,
} from "@/lib/api";

const MAX_POST_LENGTH = 5000;

export default function FeedPage() {
  const router = useRouter();
  const { address, jwt } = useWallet();

  // Feed state
  const [posts, setPosts] = useState<PostData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New post state
  const [newPostContent, setNewPostContent] = useState("");
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!jwt) {
      router.replace("/login");
    }
  }, [jwt, router]);

  // Fetch feed
  const fetchFeed = useCallback(async () => {
    if (!jwt) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getFeed(jwt, page, limit);
      setPosts(result.posts);
      setTotal(result.total);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("Failed to load feed");
      }
    } finally {
      setLoading(false);
    }
  }, [jwt, page, limit]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Create post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jwt || !newPostContent.trim()) return;
    if (newPostContent.length > MAX_POST_LENGTH) return;

    setPostLoading(true);
    setPostError(null);

    try {
      await createPost(newPostContent.trim(), jwt);
      setNewPostContent("");
      // Reset to page 1 and refresh to see the new post at the top
      setPage(1);
      await fetchFeed();
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setPostError(err.message);
      } else {
        setPostError("Failed to create post");
      }
    } finally {
      setPostLoading(false);
    }
  };

  // Delete post
  const handleDeletePost = async (postId: number) => {
    if (!jwt) return;
    setDeletingId(postId);
    try {
      await deletePost(postId, jwt);
      // Refresh feed after deletion
      await fetchFeed();
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("Failed to delete post");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const charCount = newPostContent.length;

  if (!jwt) return null;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">Feed</h1>

        {/* Create Post Form */}
        <section className="mb-8 rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">
            Create Post
          </h2>
          <form onSubmit={handleCreatePost}>
            <label htmlFor="post-content" className="sr-only">
              Post content
            </label>
            <textarea
              id="post-content"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={MAX_POST_LENGTH}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={postLoading}
            />
            <div className="mt-2 flex items-center justify-between">
              <span
                className={`text-xs ${
                  charCount > MAX_POST_LENGTH
                    ? "text-red-600"
                    : charCount > MAX_POST_LENGTH * 0.9
                    ? "text-yellow-600"
                    : "text-gray-400"
                }`}
                aria-label="Character count"
              >
                {charCount}/{MAX_POST_LENGTH}
              </span>
              <button
                type="submit"
                disabled={
                  postLoading ||
                  !newPostContent.trim() ||
                  charCount > MAX_POST_LENGTH
                }
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {postLoading ? "Posting..." : "Post"}
              </button>
            </div>
          </form>
          {postError && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {postError}
            </p>
          )}
        </section>

        {/* Error display */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Feed Posts */}
        <section className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">
            Recent Posts
          </h2>

          {loading ? (
            <div className="flex flex-col items-center py-8">
              <div
                className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"
                role="status"
                aria-label="Loading"
              />
              <p className="mt-3 text-sm text-gray-500">Loading feed...</p>
            </div>
          ) : posts.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No posts yet. Be the first to share something!
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-200" role="list">
                {posts.map((post) => (
                  <li key={post.id} className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {post.author_address}
                          </p>
                          <span className="text-xs text-gray-400">
                            {new Date(post.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                          {post.content}
                        </p>
                      </div>
                      {address &&
                        post.author_address.toLowerCase() ===
                          address.toLowerCase() && (
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            disabled={deletingId === post.id}
                            className="ml-4 shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                            aria-label={`Delete post ${post.id}`}
                          >
                            {deletingId === post.id ? "Deleting..." : "Delete"}
                          </button>
                        )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={page >= totalPages}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
