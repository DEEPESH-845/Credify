import * as postRepository from "../repositories/postRepository";
import { Post } from "../types/models";

/**
 * Creates a new post for the given author.
 *
 * Content validation (1–5000 chars) is handled by the Zod schema in the route layer.
 */
export async function createPost(
  authorAddress: string,
  content: string
): Promise<Post> {
  const normalizedAuthor = authorAddress.toLowerCase();
  return postRepository.create(normalizedAuthor, content);
}

/**
 * Deletes a post by ID, enforcing ownership.
 *
 * Throws with code NOT_FOUND if the post does not exist.
 * Throws with code FORBIDDEN if the caller is not the post author.
 */
export async function deletePost(
  postId: number,
  callerAddress: string
): Promise<void> {
  const normalizedCaller = callerAddress.toLowerCase();

  const post = await postRepository.findById(postId);
  if (!post) {
    const error = new Error("Post not found");
    (error as any).code = "NOT_FOUND";
    throw error;
  }

  if (post.author_address !== normalizedCaller) {
    const error = new Error("You can only delete your own posts");
    (error as any).code = "FORBIDDEN";
    throw error;
  }

  await postRepository.deleteById(postId);
}

/**
 * Returns a paginated, reverse-chronological feed of posts
 * from the user's accepted connections and the user's own posts.
 */
export async function getFeed(
  walletAddress: string,
  page: number,
  limit: number
): Promise<{
  posts: Post[];
  total: number;
  page: number;
  limit: number;
}> {
  const normalizedAddress = walletAddress.toLowerCase();

  const { posts, total } = await postRepository.findFeed(
    normalizedAddress,
    page,
    limit
  );

  return { posts, total, page, limit };
}
