"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useWallet } from "@/contexts/WalletContext";
import {
  getFeed,
  createPost,
  deletePost,
  getProfile,
  PostData,
  ApiRequestError,
} from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import PageLayout from "@/components/PageLayout";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { truncateAddress } from "@/lib/utils";

const MAX_POST_LENGTH = 5000;

function FeedContent() {
  const { address, jwt } = useWallet();

  // Feed state
  const [posts, setPosts] = useState<PostData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Author display names state
  const [authorNames, setAuthorNames] = useState<Record<string, string | null>>({});

  // New post state
  const [newPostContent, setNewPostContent] = useState("");
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  // Resolve author display names when posts change
  useEffect(() => {
    if (!jwt || posts.length === 0) return;

    const uniqueAddresses = [...new Set(posts.map((p) => p.author_address))];
    // Only fetch addresses we don't already have
    const addressesToFetch = uniqueAddresses.filter(
      (addr) => !(addr in authorNames)
    );

    if (addressesToFetch.length === 0) return;

    Promise.all(
      addressesToFetch.map(async (addr) => {
        try {
          const profile = await getProfile(addr, jwt);
          return { address: addr, name: profile.display_name };
        } catch {
          return { address: addr, name: null };
        }
      })
    ).then((results) => {
      setAuthorNames((prev) => {
        const updated = { ...prev };
        for (const r of results) {
          updated[r.address] = r.name;
        }
        return updated;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, jwt]);

  // Derive author display map from state
  const authorDisplayMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const post of posts) {
      const addr = post.author_address;
      if (authorNames[addr]) {
        map[addr] = authorNames[addr] as string;
      } else {
        map[addr] = truncateAddress(addr);
      }
    }
    return map;
  }, [posts, authorNames]);

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

  return (
    <>
      <h1 className="mb-6 text-3xl font-bold text-neutral-900">Feed</h1>

      {/* Create Post Form */}
      <section className="mb-8 rounded-lg bg-white p-6 shadow-card">
        <h2 className="mb-4 text-xl font-semibold text-neutral-800">
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
            className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-sm focus:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
            disabled={postLoading}
          />
          <div className="mt-2 flex items-center justify-between">
            <span
              className={`text-xs ${
                charCount > MAX_POST_LENGTH
                  ? "text-error-600"
                  : charCount > MAX_POST_LENGTH * 0.9
                  ? "text-yellow-600"
                  : "text-neutral-400"
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
              className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {postLoading ? "Posting..." : "Post"}
            </button>
          </div>
        </form>
        {postError && (
          <p className="mt-3 text-sm text-error-600" role="alert">
            {postError}
          </p>
        )}
      </section>

      {/* Error display */}
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-error-100 bg-error-50 p-4 text-sm text-error-700"
        >
          {error}
        </div>
      )}

      {/* Feed Posts */}
      <section className="rounded-lg bg-white p-6 shadow-card">
        <h2 className="mb-4 text-xl font-semibold text-neutral-800">
          Recent Posts
        </h2>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-4">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <EmptyState message="No posts yet. Be the first to share something!" />
        ) : (
          <>
            <ul className="divide-y divide-neutral-200" role="list">
              {posts.map((post) => (
                <li key={post.id} className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/profile/${post.author_address}`}
                          className="text-sm font-medium text-primary-700 hover:text-primary-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 rounded"
                        >
                          {authorDisplayMap[post.author_address] ||
                            truncateAddress(post.author_address)}
                        </Link>
                        <span className="text-xs text-neutral-400">
                          {new Date(post.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">
                        {post.content}
                      </p>
                    </div>
                    {address &&
                      post.author_address.toLowerCase() ===
                        address.toLowerCase() && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          disabled={deletingId === post.id}
                          className="ml-4 shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-error-600 transition-colors hover:bg-error-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 disabled:opacity-50"
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
              <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-neutral-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page >= totalPages}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

export default function FeedPage() {
  return (
    <AuthGuard>
      <PageLayout>
        <FeedContent />
      </PageLayout>
    </AuthGuard>
  );
}
